/**
 * Catalog sync (docs/04). Pulls configured pools from API-Football, mirrors each
 * headshot into R2, and upserts the `footballer` row. Idempotent (upsert on id),
 * so it's safe to re-run. Runs from the worker `scheduled()` cron in prod, or via
 * `pnpm sync:local` against local D1/R2.
 */
import { getDb } from '../db';
import { footballer } from '../db/schema';
import { playerPhotoKey } from '../r2';
import { fetchPlayers } from './api-football';
import { syncablePools } from './pools';

export interface SyncResult {
	pools: number;
	upserted: number;
}

export async function runCatalogSync(env: Env): Promise<SyncResult> {
	const key = env.API_FOOTBALL_KEY;
	if (!key)
		throw new Error(
			'API_FOOTBALL_KEY not set — cannot sync catalog (see .dev.vars / wrangler secret)'
		);

	const db = getDb(env.DB);
	let upserted = 0;
	const pools = syncablePools();

	for (const pool of pools) {
		const league = pool.league;
		const { apiLeagueId, season } = pool;
		if (!league || apiLeagueId == null || season == null) continue;

		const players = await fetchPlayers(key, apiLeagueId, season);
		for (const p of players) {
			const id = `af:${p.id}`;
			const photoKey = playerPhotoKey(id);

			if (p.photo) {
				const res = await fetch(p.photo);
				if (res.ok) {
					await env.ASSETS_BUCKET.put(photoKey, await res.arrayBuffer(), {
						httpMetadata: { contentType: res.headers.get('content-type') ?? 'image/png' }
					});
				}
			}

			const row = {
				id,
				name: p.name,
				fullName: p.fullName ?? null,
				nationality: p.nationality ?? null,
				position: p.position ?? null,
				club: p.club ?? null,
				league,
				season,
				birthYear: p.birthYear ?? null,
				photoKey,
				active: true,
				updatedAt: new Date()
			};
			const { id: _id, ...rest } = row;
			await db
				.insert(footballer)
				.values(row)
				.onConflictDoUpdate({ target: footballer.id, set: rest });
			upserted++;
		}
	}

	// Stale-marking (rows not seen this run → active=false) is deferred; MVP re-seeds whole pools.
	return { pools: pools.length, upserted };
}
