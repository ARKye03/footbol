import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { sampleBoard } from '$lib/server/db/catalog';
import { DEFAULT_BOARD_SIZE, POOLS, getPool } from '$lib/server/ingest/pools';
import type { PageServerLoad } from './$types';

/** Dev preview: render a sampled board for a pool, proving D1 + R2 (via /img) work locally. */
export const load: PageServerLoad = async ({ platform, params }) => {
	const d1 = platform?.env.DB;
	if (!d1)
		error(
			500,
			'D1 binding DB not available — run via `pnpm dev` (platformProxy) or `pnpm dev:full`'
		);

	const pool = getPool(params.pool ?? '') ?? POOLS[0];
	if (!pool) error(500, 'no pools configured');

	const board = await sampleBoard(getDb(d1), {
		league: pool.league,
		season: pool.season,
		size: pool.boardSize ?? DEFAULT_BOARD_SIZE
	});

	return {
		board,
		pool: { id: pool.id, label: pool.label },
		pools: POOLS.map((p) => ({ id: p.id, label: p.label }))
	};
};
