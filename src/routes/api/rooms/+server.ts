import { error, json } from '@sveltejs/kit';
import { generateRoomCode } from '$lib/game/code';
import { POOLS, getPool } from '$lib/server/ingest/pools';
import type { RequestHandler } from './$types';

/**
 * Create a room: pick a pool, mint a code. The board itself is built lazily by the
 * Durable Object on first connect (docs/06), so this stores nothing — the chosen
 * pool travels with the creator to `/play/[code]`.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'no session');

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const poolId = typeof body.poolId === 'string' ? body.poolId : '';
	const pool = getPool(poolId) ?? POOLS[0];
	if (!pool) error(500, 'no pools configured');

	const code = generateRoomCode();
	return json({ code, pool: { id: pool.id, label: pool.label, boardSize: pool.boardSize } });
};
