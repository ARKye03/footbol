import { and, eq, sql } from 'drizzle-orm';
import type { BoardCard } from '$lib/game/state';
import type { getDb } from './index';
import { footballer } from './schema';

type Db = ReturnType<typeof getDb>;

export interface PoolFilter {
	league: string | null;
	season: number | null;
	size: number;
}

/**
 * Pick a board for a room: `size` random active footballers from the filtered pool.
 * The board is fixed for the life of the room (stored in DO state), so this runs
 * once per game at start (docs/04). Returns fewer than `size` if the pool is small.
 */
export async function sampleBoard(
	db: Db,
	{ league, season, size }: PoolFilter
): Promise<BoardCard[]> {
	const filters = [eq(footballer.active, true)];
	if (league) filters.push(eq(footballer.league, league));
	if (season != null) filters.push(eq(footballer.season, season));

	return db
		.select({
			footballerId: footballer.id,
			name: footballer.name,
			photoKey: footballer.photoKey,
			position: footballer.position,
			nationality: footballer.nationality
		})
		.from(footballer)
		.where(and(...filters))
		.orderBy(sql`random()`)
		.limit(size);
}

/**
 * Candidate pool in a **deterministic** order (by id), so the Durable Object can
 * pick a board with seeded `buildBoard` (reproducible given the seed + catalog).
 */
export async function listPool(
	db: Db,
	{ league, season }: Omit<PoolFilter, 'size'>,
	limit = 400
): Promise<BoardCard[]> {
	const filters = [eq(footballer.active, true)];
	if (league) filters.push(eq(footballer.league, league));
	if (season != null) filters.push(eq(footballer.season, season));

	return db
		.select({
			footballerId: footballer.id,
			name: footballer.name,
			photoKey: footballer.photoKey,
			position: footballer.position,
			nationality: footballer.nationality
		})
		.from(footballer)
		.where(and(...filters))
		.orderBy(footballer.id)
		.limit(limit);
}
