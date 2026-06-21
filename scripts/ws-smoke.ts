/**
 * Realtime smoke test (docs/08 tier 3, lighter variant). Drives two WebSocket
 * clients through the running `pnpm dev:full` worker and asserts that join + state
 * changes propagate through the GameRoom Durable Object. Mints tokens directly
 * with the same `BETTER_AUTH_SECRET` wrangler loads from `.dev.vars`, so no browser
 * session is needed. Run the server first (`pnpm dev:full`), then `pnpm tsx scripts/ws-smoke.ts`.
 */
import { readFileSync } from 'node:fs';
import { generateRoomCode } from '../src/lib/game/code';
import { mintRoomToken } from '../src/lib/server/tokens';

const HOST = process.env.WS_HOST ?? 'localhost:8787';
const CODE = generateRoomCode(); // fresh room each run — DO state persists in .wrangler/state

function secret(): string {
	const m = readFileSync('.dev.vars', 'utf8').match(/^BETTER_AUTH_SECRET=(.*)$/m);
	const raw = (m?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
	if (!raw) throw new Error('BETTER_AUTH_SECRET not found in .dev.vars');
	return raw;
}

type Msg = { t: string; [k: string]: unknown };

function client(name: string, pid: string) {
	const ws = new WebSocket(`ws://${HOST}/ws/${CODE}?pid=${pid}&pool=all-stars`);
	const seen: Msg[] = [];
	const waiters: ((m: Msg) => void)[] = [];
	ws.addEventListener('message', (e) => {
		const m = JSON.parse(String((e as MessageEvent).data)) as Msg;
		seen.push(m);
		for (const w of [...waiters]) w(m);
	});
	const open = new Promise<void>((res) => ws.addEventListener('open', () => res()));
	const next = (pred: (m: Msg) => boolean, ms = 5000) =>
		new Promise<Msg>((res, rej) => {
			const hit = seen.find(pred);
			if (hit) return res(hit);
			const w = (m: Msg) => {
				if (pred(m)) {
					waiters.splice(waiters.indexOf(w), 1);
					res(m);
				}
			};
			waiters.push(w);
			setTimeout(() => rej(new Error(`${name}: timeout waiting for message`)), ms);
		});
	return { open, next, send: (m: object) => ws.send(JSON.stringify(m)), close: () => ws.close() };
}

function assert(cond: unknown, label: string) {
	if (!cond) throw new Error(`FAIL: ${label}`);
	console.log(`  ✓ ${label}`);
}

async function main() {
	const s = secret();
	const t1 = await mintRoomToken({ userId: 'p1', code: CODE }, s);
	const t2 = await mintRoomToken({ userId: 'p2', code: CODE }, s);

	const a = client('A', 'p1');
	await a.open;
	a.send({ t: 'hello', token: t1, name: 'Alice' });
	await a.next((m) => m.t === 'state');
	console.log('A connected to lobby');

	const b = client('B', 'p2');
	await b.open;
	b.send({ t: 'hello', token: t2, name: 'Bob' });

	const aPlay = await a.next(
		(m) => m.t === 'state' && (m.state as { phase: string }).phase === 'playing'
	);
	const bPlay = await b.next(
		(m) => m.t === 'state' && (m.state as { phase: string }).phase === 'playing'
	);
	const board = (aPlay.state as { board: unknown[] }).board;
	const players = (aPlay.state as { players: object }).players;
	assert(Object.keys(players).length === 2, 'both players present after 2nd join');
	assert(board.length > 0, 'board built and propagated');
	assert(
		(bPlay.state as { phase: string }).phase === 'playing',
		'opponent auto-started into playing'
	);

	const turn = (aPlay.state as { turn: string }).turn;
	const asker = turn === 'p1' ? a : b;
	const answerer = turn === 'p1' ? b : a;
	asker.send({ t: 'ask', text: 'is a defender?' });
	const patch = await answerer.next(
		(m) => m.t === 'patch' && (m.chat as { kind?: string } | undefined)?.kind === 'question'
	);
	assert(
		(patch.chat as { text: string }).text === 'is a defender?',
		'question propagated to opponent'
	);

	a.send({ t: 'leave' });
	const over = await b.next((m) => m.t === 'gameOver');
	assert(over.winnerId === 'p2', 'forfeit by A hands win to B');

	a.close();
	b.close();
	console.log('\nPASS — realtime round-trip OK');
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
