import { describe, expect, it } from 'vitest';
import { assignSecrets, buildBoard, mulberry32 } from './board';
import type { BoardCard } from './state';

const pool = (n: number): BoardCard[] =>
	Array.from({ length: n }, (_, i) => ({
		footballerId: `f${i}`,
		name: `P${i}`,
		photoKey: `players/f${i}.svg`
	}));

describe('mulberry32', () => {
	it('is deterministic for a seed and varies across seeds', () => {
		const a = Array.from({ length: 5 }, mulberry32(7));
		const b = Array.from({ length: 5 }, mulberry32(7));
		const c = Array.from({ length: 5 }, mulberry32(8));
		expect(a).toEqual(b);
		expect(a).not.toEqual(c);
		expect(a.every((x) => x >= 0 && x < 1)).toBe(true);
	});
});

describe('buildBoard', () => {
	it('is reproducible for the same seed', () => {
		expect(buildBoard(pool(30), 12, 99)).toEqual(buildBoard(pool(30), 12, 99));
	});

	it('returns exactly `size` distinct cards from the pool', () => {
		const board = buildBoard(pool(30), 12, 1);
		expect(board).toHaveLength(12);
		const ids = new Set(board.map((c) => c.footballerId));
		expect(ids.size).toBe(12);
		expect(board.every((c) => c.footballerId.startsWith('f'))).toBe(true);
	});

	it('caps at the pool size when the pool is smaller than `size`', () => {
		expect(buildBoard(pool(5), 24, 3)).toHaveLength(5);
	});

	it('different seeds generally produce different boards', () => {
		const a = buildBoard(pool(30), 12, 1);
		const b = buildBoard(pool(30), 12, 2);
		expect(a).not.toEqual(b);
	});
});

describe('assignSecrets', () => {
	it('assigns a distinct board card to each player, deterministically', () => {
		const board = buildBoard(pool(20), 16, 5);
		const order = ['a', 'b'];
		const secrets = assignSecrets(board, order, 5);
		expect(assignSecrets(board, order, 5)).toEqual(secrets);
		expect(secrets.a).not.toBe(secrets.b);
		const ids = new Set(board.map((c) => c.footballerId));
		expect(ids.has(secrets.a)).toBe(true);
		expect(ids.has(secrets.b)).toBe(true);
	});

	it('throws when the board cannot cover all players', () => {
		expect(() => assignSecrets(pool(1), ['a', 'b'], 1)).toThrow();
	});
});
