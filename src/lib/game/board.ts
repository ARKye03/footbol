/**
 * Board sampling + secret assignment. Pure and seeded so games are reproducible
 * and unit-testable without any I/O (docs/03). The candidate `pool` comes from
 * the catalog (`sampleBoard`, docs/04); the Durable Object calls these at room
 * init, but tests can drive them with plain fixtures.
 */
import type { BoardCard } from './state';

/** Deterministic PRNG (mulberry32). Same seed → same sequence. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Seeded Fisher–Yates over a copy. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Pick `size` cards from `pool` deterministically. Returns fewer if the pool is small. */
export function buildBoard(pool: readonly BoardCard[], size: number, seed: number): BoardCard[] {
	return shuffle(pool, mulberry32(seed)).slice(0, Math.min(size, pool.length));
}

/**
 * Assign each player a secret identity card from the board (the card the OPPONENT
 * must guess). Returns `playerId → footballerId`. Secrets are distinct. Uses a
 * decorrelated stream from `buildBoard` so the secret isn't trivially the first card.
 */
export function assignSecrets(
	board: readonly BoardCard[],
	order: readonly string[],
	seed: number
): Record<string, string> {
	if (board.length < order.length) {
		throw new Error(`board too small (${board.length}) to assign ${order.length} secrets`);
	}
	const picks = shuffle(board, mulberry32((seed ^ 0x9e3779b9) >>> 0));
	const secrets: Record<string, string> = {};
	order.forEach((playerId, i) => {
		secrets[playerId] = picks[i].footballerId;
	});
	return secrets;
}
