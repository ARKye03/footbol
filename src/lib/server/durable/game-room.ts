import { DurableObject } from 'cloudflare:workers';
import { assignSecrets, buildBoard } from '$lib/game/board';
import { encode, parseClientMessage, toPublicState, type ServerMessage } from '$lib/game/protocol';
import { freshState, GRACE_MS, reduce, toCommand, type Command } from '$lib/game/rules';
import { DEFAULT_PENALTY_QUESTIONS, type GameState, type PlayerSlot } from '$lib/game/state';
import { getDb } from '$lib/server/db';
import { listPool } from '$lib/server/db/catalog';
import { gameRecord } from '$lib/server/db/schema';
import { getPool, POOLS, type Pool } from '$lib/server/ingest/pools';
import { verifyRoomToken } from '$lib/server/tokens';

interface SocketMeta {
	code: string; // room code from the URL path (verified against the token on hello)
	pool: string; // pool id, used to build the board on first connect
	authed: boolean; // true only after verifyRoomToken succeeds
	pid: string | null; // VERIFIED player id (from the token), set on hello — the only id we route on
}

const WS_PATH = /\/ws\/([A-Za-z0-9_-]+)/;

/** CSPRNG 31-bit seed — board/secret selection is security-relevant (predictable seed = predictable secret). */
const randomSeed = (): number => {
	const buf = new Uint32Array(1);
	crypto.getRandomValues(buf);
	return buf[0] & 0x7fffffff;
};

/**
 * GameRoom — one Durable Object per room code; the single authority for live game
 * state (docs/03). Sockets use the WebSocket Hibernation API (idle rooms ~free).
 * Identity comes ONLY from the verified token (`hello`), stored in the socket
 * attachment — the connection's query `pid` is untrusted and never used to route
 * secret state. All game decisions delegate to the pure `reduce`; the DO owns I/O:
 * sockets, storage, the abandonment alarm, and the finished-game history write.
 */
export class GameRoom extends DurableObject<Env> {
	private state: GameState | null = null;

	private async load(): Promise<GameState | null> {
		this.state ??= (await this.ctx.storage.get<GameState>('game')) ?? null;
		return this.state;
	}

	private async save(state: GameState): Promise<void> {
		this.state = state;
		await this.ctx.storage.put('game', state);
	}

	private metaOf(ws: WebSocket): SocketMeta | null {
		return (ws.deserializeAttachment() as SocketMeta | null) ?? null;
	}

	// Routing is gated on the VERIFIED attachment identity, never the connection tag:
	// an unauthenticated socket (e.g. one claiming someone else's id) receives nothing.
	private sendTo(playerId: string, msg: ServerMessage): void {
		const frame = encode(msg);
		for (const ws of this.ctx.getWebSockets()) {
			const m = this.metaOf(ws);
			if (m?.authed && m.pid === playerId) ws.send(frame);
		}
	}

	private broadcast(msg: ServerMessage, exceptPlayerId?: string): void {
		const frame = encode(msg);
		for (const ws of this.ctx.getWebSockets()) {
			const m = this.metaOf(ws);
			if (!m?.authed) continue;
			if (exceptPlayerId && m.pid === exceptPlayerId) continue;
			ws.send(frame);
		}
	}

	private sendState(state: GameState, playerId: string): void {
		this.sendTo(playerId, { t: 'state', state: toPublicState(state, playerId), you: playerId });
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('upgrade') !== 'websocket') {
			return new Response('expected websocket upgrade', { status: 426 });
		}
		const url = new URL(request.url);
		const code = (url.pathname.match(WS_PATH)?.[1] ?? '').toUpperCase();
		if (!code) return new Response('missing room code', { status: 400 });

		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server); // untagged — identity is established on hello, not here
		const meta: SocketMeta = {
			code,
			pool: url.searchParams.get('pool') ?? '',
			authed: false,
			pid: null
		};
		server.serializeAttachment(meta);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		if (typeof raw !== 'string') return;
		const msg = parseClientMessage(raw);
		if (!msg) return;

		const meta = this.metaOf(ws);
		if (!meta) return ws.close(4000, 'bad_socket');

		if (msg.t === 'hello') return this.onHello(ws, meta, msg.token, msg.name);

		if (!meta.authed || !meta.pid)
			return ws.send(encode({ t: 'error', message: 'not_authenticated' }));
		if (msg.t === 'rematch') return this.onRematch(meta.pid);

		const cmd = toCommand(msg, meta.pid);
		if (cmd) await this.apply(cmd, meta.pid);
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const meta = this.metaOf(ws);
		const state = await this.load();
		const pid = meta?.authed ? meta.pid : null;
		if (!pid || !state || !state.players[pid]) return;

		const r = reduce(state, { t: 'disconnect', playerId: pid }, Date.now());
		await this.save(r.state);
		for (const m of r.broadcast) this.broadcast(m, pid);
		if (isLive(r.state.phase)) {
			await this.ctx.storage.setAlarm(Date.now() + GRACE_MS);
		}
	}

	/** Grace period elapsed: a player still gone mid-game abandons; resolve per phase (docs/11). */
	async alarm(): Promise<void> {
		const state = await this.load();
		if (!state || !isLive(state.phase)) return;
		const gone = state.order.find((id) => state.players[id] && !state.players[id].connected);
		if (!gone) return; // they came back

		// Phase-aware abandon: the forfeit handler routes winnerId per phase and stamps the
		// generic ending as `abandoned` (named draw/held outcomes keep their semantic reason).
		const r = reduce(state, { t: 'forfeit', playerId: gone, abandoned: true }, Date.now());
		const next = r.state;
		await this.save(next);
		for (const m of r.broadcast) this.broadcast(m);
		this.ctx.waitUntil(this.writeHistory(next));
	}

	private async onHello(
		ws: WebSocket,
		meta: SocketMeta,
		token: string,
		name: string
	): Promise<void> {
		const claims = await verifyRoomToken(token, this.env.BETTER_AUTH_SECRET);
		if (!claims || claims.code !== meta.code) return ws.close(4001, 'unauthorized');
		const pid = claims.userId; // trusted identity from the signed token

		let state =
			(await this.load()) ??
			freshState(
				meta.code,
				{ league: null, season: null, boardSize: 0, penaltyQuestions: DEFAULT_PENALTY_QUESTIONS },
				[],
				0
			);
		if (state.board.length === 0) state = await this.buildRoom(state, meta.pool);

		const existing = !!state.players[pid];
		if (!existing && state.order.length >= 2) return ws.close(4002, 'room_full');

		// Authenticate this socket (identity = verified pid) before any state is routed to it.
		ws.serializeAttachment({ ...meta, authed: true, pid });

		const cmd: Command = existing
			? { t: 'reconnect', playerId: pid }
			: { t: 'join', playerId: pid, name };
		const r = reduce(state, cmd, Date.now());
		state = r.state;

		// Auto-start once both players are present (no separate start intent in the protocol).
		if (state.phase === 'ready') state = reduce(state, { t: 'start' }, Date.now()).state;

		await this.save(state);

		this.sendState(state, pid); // full snapshot to the (re)connecting player
		for (const m of r.broadcast) this.broadcast(m, pid); // join/back notice to the other
		// If the game is (now) playing — e.g. this join auto-started it — refresh the
		// opponent too so the freshly built board + assigned turn propagate.
		if (state.phase === 'playing') {
			for (const id of state.order) if (id !== pid) this.sendState(state, id);
		}
	}

	/**
	 * Build the board on first connect. Two INDEPENDENT CSPRNG seeds: `boardSeed`
	 * drives the (public) board order; `secretSeed` (stored as `state.seed`, stripped
	 * from public state) drives secret assignment at `start`. Independence means the
	 * public board order can't be used to recover/predict the secrets.
	 */
	private async buildRoom(state: GameState, poolId: string): Promise<GameState> {
		const pool: Pool = getPool(poolId) ?? getPool('all-stars')!;
		const db = getDb(this.env.DB);
		const candidates = await listPool(db, { league: pool.league, season: pool.season });
		const board = buildBoard(candidates, pool.boardSize, randomSeed());
		return {
			...state,
			seed: randomSeed(), // secretSeed — independent of the board order
			config: {
				league: pool.league,
				season: pool.season,
				boardSize: pool.boardSize,
				penaltyQuestions: DEFAULT_PENALTY_QUESTIONS
			},
			board
		};
	}

	private async apply(cmd: Command, actor: string): Promise<void> {
		const state = await this.load();
		if (!state) return;
		const wasFinished = state.phase === 'finished';
		const r = reduce(state, cmd, Date.now());
		if (r.error) return this.sendTo(actor, { t: 'error', message: r.error });

		await this.save(r.state);
		for (const m of r.broadcast) {
			if (m.t === 'opponentLeft' || m.t === 'opponentBack') this.broadcast(m, actor);
			else this.broadcast(m);
		}
		if (!wasFinished && r.state.phase === 'finished')
			this.ctx.waitUntil(this.writeHistory(r.state));
	}

	/** Rematch: rebuild board + secrets with a fresh seed, swap roles, back to playing. */
	private async onRematch(actor: string): Promise<void> {
		const state = await this.load();
		if (!state || state.phase !== 'finished')
			return this.sendTo(actor, { t: 'error', message: 'not_finished' });

		const rebuilt = await this.buildRoom({ ...state, board: [] }, poolIdOf(state));
		// Swap roles: the previous Second (order[1]) leads the rematch, so the equalizer
		// advantage alternates across games (docs/11 § Roles). New starterId = old order[1].
		const order = state.order.length === 2 ? [state.order[1], state.order[0]] : [...state.order];
		const players: Record<string, PlayerSlot> = {};
		for (const id of state.order)
			players[id] = { ...state.players[id], secretId: null, eliminated: [] };
		const secrets = assignSecrets(rebuilt.board, order, rebuilt.seed);
		for (const id of order) players[id].secretId = secrets[id];

		const next: GameState = {
			...rebuilt,
			players,
			order,
			starterId: order[0],
			phase: 'playing',
			turn: order[0],
			turns: 0,
			awaitingAnswer: false,
			answeredThisTurn: false,
			penalty: null,
			chat: [],
			winnerId: null,
			endReason: null,
			startedAt: Date.now(),
			version: state.version + 1
		};
		await this.save(next);
		for (const id of order) this.sendState(next, id);
	}

	private async writeHistory(state: GameState): Promise<void> {
		if (state.order.length < 2) return; // need both players
		try {
			await getDb(this.env.DB)
				.insert(gameRecord)
				.values({
					roomCode: state.code,
					poolLeague: state.config.league,
					poolSeason: state.config.season,
					boardSize: state.board.length,
					player1Id: state.order[0],
					player2Id: state.order[1],
					winnerId: state.winnerId,
					endReason: state.endReason ?? 'abandoned',
					turns: state.turns,
					startedAt: new Date(state.startedAt ?? Date.now()),
					endedAt: new Date()
				});
		} catch (err) {
			console.error('gameRecord write failed', err);
		}
	}
}

/** A phase where a leaving player matters: grace alarm fires and abandon resolves per docs/11. */
function isLive(phase: GameState['phase']): boolean {
	return phase === 'ready' || phase === 'playing' || phase === 'penalty' || phase === 'equalizer';
}

function poolIdOf(state: GameState): string {
	// Recover the configured pool from the room's league/season (best-effort; falls back to all-stars).
	const match = POOLS.find(
		(p) => p.league === state.config.league && p.season === state.config.season
	);
	return match?.id ?? 'all-stars';
}
