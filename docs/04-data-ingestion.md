# 04 — Data Ingestion

Footballer data and headshots are **pre-loaded** into D1/R2. Nothing calls API-Football on the request path (rate limits + cost + latency). Two entry points:

- **Offline seed** — sample fixtures for local dev, no API key needed.
- **Catalog sync** — pulls from API-Football, mirrors images to R2, upserts D1. Run manually or on a cron.

## API-Football

- Provider: API-Football (api-sports.io / RapidAPI). Auth via `x-apisports-key` header (or RapidAPI headers).
- Key in `API_FOOTBALL_KEY` — runtime secret (`.dev.vars` locally, `wrangler secret` in prod). **Never** ship it client-side.
- Relevant endpoints: `/players?league=&season=&page=` (paginated; includes `player.photo`), `/leagues`, `/teams`. Respect rate limits — page sequentially with backoff; the free tier is small, so sync is a background job, not interactive.

```ts
// src/lib/server/ingest/api-football.ts
export interface RawPlayer {
	id: number;
	name: string;
	photo: string;
	nationality: string; /* ... */
}
export async function fetchPlayers(
	key: string,
	league: number,
	season: number
): Promise<RawPlayer[]>;
```

## Sync pipeline (`src/lib/server/ingest/sync.ts`)

```
for each configured (league, season):
  fetchPlayers() → normalize → for each player:
    1. derive stable id: `af:<apiId>`
    2. fetch player.photo → transcode to webp (~256px) → R2.put(`players/af:<id>.webp`)
    3. upsert footballer row (name, league, season, position, club, nationality, birthYear, photoKey, attrs, updatedAt)
  mark stale rows (not seen this run) active=false
```

- **Idempotent**: re-running updates in place (upsert on `id`). Safe to re-run after a failure.
- **Image transcode**: in a Worker, use the Images binding / `fetch` + resize, or pre-process in the offline script (sharp) and just `R2.put` the bytes. For cron-in-worker, fetching the remote photo and storing as-is (with a normalized key) is acceptable for MVP; optimize later.
- **Configured pools**: a small static list in `src/lib/server/ingest/pools.ts` (e.g. top-5 leagues, current + a couple past seasons). This list defines what's available in the pool picker UI.

### Two ways to run it

- **Cron (prod)**: `worker.ts` `scheduled()` → `runCatalogSync(env)` on the `triggers.crons` schedule ([01](./01-architecture.md)). Weekly is plenty.
- **Manual / local**: a Node script `scripts/sync.ts` using `getPlatformProxy()` to get `env` (D1 + R2 bindings) outside a request, so you can populate **local** storage from a real key without deploying. Gate behind an explicit `pnpm sync:local`.

## Offline seed (no API key) — the local-dev default

Most contributors won't have an API key. Provide a committed fixture + a one-command loader so the app is playable offline.

- `fixtures/footballers.sample.json` — ~30–50 footballers with fields matching the `footballer` schema. `photoKey` points at bundled placeholder/sample images (committed under `fixtures/img/` or just reuse `_placeholder.webp`).
- **Loader options** (pick one; both documented in [07](./07-local-development.md)):
  1. **Dev route** `routes/api/dev/seed/+server.ts` — POST handler, **guarded to dev only** (`if (!dev) error(404)`), uses `event.platform.env` to upsert D1 rows + `R2.put` the sample images. Works under `vite dev` (platformProxy). One click from a dev page or `curl`.
  2. **Script** `scripts/seed.ts` — `getPlatformProxy()` + Drizzle + R2 put. Run via `pnpm seed:local`. No dev server needed.

```ts
// scripts/seed.ts (sketch)
import { getPlatformProxy } from 'wrangler';
const { env, dispose } = await getPlatformProxy(); // local D1/R2 from wrangler.jsonc + .dev.vars
const db = getDb(env.DB as D1Database);
const players = JSON.parse(await readFile('fixtures/footballers.sample.json', 'utf8'));
for (const p of players) {
	await env.ASSETS_BUCKET.put(p.photoKey, await readImage(p));
	await db.insert(footballer).values(p).onConflictDoUpdate({ target: footballer.id, set: p });
}
await dispose();
```

## Pool query (`src/lib/server/db/catalog.ts`)

```ts
// pick the board for a room: random N from the filtered pool
export async function sampleBoard(db, { league, season, size }): Promise<BoardCard[]>;
```

Implementation: `SELECT id, name, photo_key FROM footballer WHERE active AND league=? [AND season=?] ORDER BY random() LIMIT ?`. Optionally cache the candidate set in KV (`POOL_CACHE`) and sample in app code. The board is fixed for the life of the room (stored in DO state), so this runs once per game at `start`.
