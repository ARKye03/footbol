/**
 * Client WebSocket store (docs/03, docs/06). A runes class is the single source of
 * client-side game state: components read its `$state` fields and call its methods.
 * The Durable Object is authoritative — everything adjudicated (turns, answers,
 * guesses, game over) waits for a broadcast. Only private card flips are optimistic.
 */
import { SvelteSet } from 'svelte/reactivity';
import type { ClientMessage, PublicGameState, ServerMessage } from '$lib/game/protocol';
import type { BoardCard, ChatEntry, Phase, PlayerSlot } from '$lib/game/state';

export interface RoomSocketInit {
	code: string;
	wsToken: string;
	me: { id: string; name: string };
	poolId?: string;
}

const MAX_BACKOFF_MS = 10_000;

export class RoomSocket {
	phase = $state<Phase>('lobby');
	board = $state<BoardCard[]>([]);
	players = $state<Record<string, PlayerSlot>>({});
	order = $state<string[]>([]);
	chat = $state<ChatEntry[]>([]);
	turn = $state<string | null>(null);
	awaitingAnswer = $state(false);
	you = $state('');
	readonly eliminated = new SvelteSet<string>(); // my private flips (optimistic; stable reactive instance)
	connected = $state(false);
	opponentLeftAt = $state<number | null>(null); // grace deadline (ms epoch)
	result = $state<{
		winnerId: string | null;
		reason: string;
		reveal: Record<string, string>;
	} | null>(null);
	error = $state<string | null>(null);
	fatal = $state<string | null>(null); // a non-recoverable close (e.g. room_full, unauthorized)

	#ws: WebSocket | null = null;
	#init: RoomSocketInit;
	#retries = 0;
	#closed = false;

	constructor(init: RoomSocketInit) {
		this.#init = init;
		this.you = init.me.id;
		this.#connect();
	}

	get myTurn(): boolean {
		return this.phase === 'playing' && this.turn === this.you;
	}

	get opponentId(): string | null {
		return this.order.find((id) => id !== this.you) ?? null;
	}

	get me(): PlayerSlot | undefined {
		return this.players[this.you];
	}

	#connect(): void {
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		const { code, me, poolId } = this.#init;
		const url = `${proto}://${location.host}/ws/${code}?pid=${encodeURIComponent(me.id)}&pool=${encodeURIComponent(poolId ?? '')}`;
		const ws = new WebSocket(url);
		this.#ws = ws;
		ws.onopen = () => {
			this.#retries = 0;
			this.#send({ t: 'hello', token: this.#init.wsToken, name: me.name });
		};
		ws.onmessage = (e) => this.#onMessage(JSON.parse(e.data) as ServerMessage);
		ws.onclose = (e) => {
			this.connected = false;
			// 4001 unauthorized, 4002 room_full — don't retry; surface the reason.
			if (e.code === 4001 || e.code === 4002) {
				this.fatal = e.reason || 'error';
				this.#closed = true;
				return;
			}
			if (!this.#closed) this.#scheduleReconnect();
		};
		ws.onerror = () => ws.close();
	}

	#scheduleReconnect(): void {
		const delay = Math.min(500 * 2 ** this.#retries++, MAX_BACKOFF_MS);
		setTimeout(() => {
			if (!this.#closed) this.#connect();
		}, delay);
	}

	#onMessage(msg: ServerMessage): void {
		switch (msg.t) {
			case 'state':
				this.#applyState(msg.state, msg.you);
				this.connected = true;
				break;
			case 'patch':
				if (msg.phase) this.phase = msg.phase;
				if (msg.turn !== undefined) this.turn = msg.turn;
				if (msg.chat) this.chat = [...this.chat, msg.chat];
				break;
			case 'opponentLeft':
				this.opponentLeftAt = Date.now() + msg.graceMs;
				break;
			case 'opponentBack':
				this.opponentLeftAt = null;
				break;
			case 'gameOver':
				this.result = { winnerId: msg.winnerId, reason: msg.reason, reveal: msg.secretReveal };
				this.phase = 'finished';
				break;
			case 'error':
				this.error = msg.message;
				break;
		}
	}

	#applyState(s: PublicGameState, you: string): void {
		this.you = you;
		this.phase = s.phase;
		this.board = s.board;
		this.players = s.players;
		this.order = s.order;
		this.chat = s.chat;
		this.turn = s.turn;
		this.awaitingAnswer = s.awaitingAnswer;
		this.eliminated.clear();
		for (const id of s.players[you]?.eliminated ?? []) this.eliminated.add(id);
		if (s.phase !== 'finished') this.result = null;
	}

	#send(msg: ClientMessage): void {
		if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(msg));
	}

	// --- intents ---
	ask(text: string): void {
		this.#send({ t: 'ask', text });
	}
	answer(value: boolean): void {
		this.#send({ t: 'answer', value });
	}
	endTurn(): void {
		this.#send({ t: 'endTurn' });
	}
	flip(footballerId: string, down: boolean): void {
		// optimistic: reflect locally now; the DO persists it for reconnect
		if (down) this.eliminated.add(footballerId);
		else this.eliminated.delete(footballerId);
		this.#send({ t: 'flip', footballerId, down });
	}
	guess(footballerId: string): void {
		this.#send({ t: 'guess', footballerId });
	}
	rematch(): void {
		this.#send({ t: 'rematch' });
	}
	leave(): void {
		this.#send({ t: 'leave' });
	}

	close(): void {
		this.#closed = true;
		this.#ws?.close();
	}
}
