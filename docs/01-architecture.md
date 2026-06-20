# 01 — Architecture

## High-level

Everything runs as **one Cloudflare Worker** on the edge. SvelteKit (compiled by `@sveltejs/adapter-cloudflare`, workers target) serves pages, API routes, and assets. A custom worker entry sits in front to peel off WebSocket upgrades and hand them to a **Durable Object** (one per room) that owns live game state. D1 stores the footballer catalog and finished-game history; R2 stores headshots; KV optionally caches pool queries.

```
                         ┌──────────────────────────────────────────────┐
  Browser (Player A) ───▶│  Cloudflare Worker  (src/worker.ts entry)      │
  Browser (Player B) ───▶│                                                │
        │  HTTPS          │   fetch(req):                                  │
        │                 │     if path startsWith "/ws/"  ─┐              │
        │                 │        → GAME_ROOM.get(code).fetch(req)        │
        │  WebSocket      │     else → SvelteKit handler (_worker.js)      │
        └────────────────▶│                                  │            │
                          │   scheduled():  API-Football refresh (cron)    │
                          └───────────────┬──────────────────┼────────────┘
                                          │                  │
                    ┌─────────────────────┘                  ▼
                    ▼                              ┌──────────────────────┐
        ┌───────────────────────┐                 │  Durable Object       │
        │ SvelteKit (pages/API)  │                 │  GameRoom (1 per code)│
        │  hooks.server.ts:      │                 │  - WebSocket hibern.  │
        │   paraglide + guest    │                 │  - authoritative state│
        │   auth + platform      │                 │  - storage (snapshot) │
        └───────────┬───────────┘                 │  - alarm (expiry/grace)│
                    │                              └───────────┬──────────┘
       ┌────────────┼─────────────┐                           │ writes results
       ▼            ▼             ▼                            ▼
   ┌───────┐   ┌─────────┐   ┌─────────┐                  ┌────────┐
   │  D1   │   │   R2    │   │   KV    │                  │   D1   │
   │catalog│   │headshots│   │pool cache│                 │history │
   └───────┘   └─────────┘   └─────────┘                  └────────┘
```

## Why these pieces

| Concern         | Choice                                  | Why                                                                                                                                                               |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App framework   | SvelteKit + Svelte 5 runes              | Tiny payloads, native reactivity, one framework for SSR + client. Runes forced on (`vite.config.ts`).                                                             |
| Hosting         | Cloudflare Workers (adapter-cloudflare) | Global edge, cheap, co-located with DO/D1/R2.                                                                                                                     |
| Live state      | Durable Objects + WS Hibernation        | A DO is single-threaded → game-state mutations serialize naturally (no race conditions). Hibernation keeps idle rooms ~free. One DO per room = perfect isolation. |
| Relational data | D1 (SQLite) + Drizzle                   | Type-safe schema/queries; SQLite is plenty for a catalog + history.                                                                                               |
| Images          | R2                                      | Zero egress; mirror API-Football headshots once, serve fast forever.                                                                                              |
| Cache           | KV (optional)                           | Pool/board queries are read-heavy and rarely change.                                                                                                              |
| i18n            | Paraglide                               | Compile-time messages, no runtime cost, type-safe, EN/ES.                                                                                                         |
| Identity        | Better Auth (`anonymous` plugin)        | Guest now, real account later, one identity model.                                                                                                                |
| Pkg manager     | pnpm                                    | Fast, workspace-ready.                                                                                                                                            |

## The realtime seam (most important design point)

`@sveltejs/adapter-cloudflare` generates `.svelte-kit/cloudflare/_worker.js`. SvelteKit's request handler **cannot cleanly return a hibernatable WebSocket** from a `+server.ts` endpoint, and a Durable Object class must be **exported from the Worker's top-level module**. We solve both with a thin custom entry:

```ts
// src/worker.ts  (wrangler `main` points here)
import { default as sveltekit } from '../.svelte-kit/cloudflare/_worker.js';
export { GameRoom } from '$lib/server/durable/game-room';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		// /ws/<roomCode> → route to that room's Durable Object
		const ws = url.pathname.match(/^\/ws\/([A-Za-z0-9_-]+)$/);
		if (ws) {
			const code = ws[1].toUpperCase();
			const id = env.GAME_ROOM.idFromName(code);
			return env.GAME_ROOM.get(id).fetch(request);
		}
		// everything else → SvelteKit (pages, API routes, static assets)
		return sveltekit.fetch(request, env, ctx);
	},
	// optional: periodic catalog refresh
	async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(runCatalogSync(env)); // see docs/04
	}
};
```

Build order matters: `vite build` produces `_worker.js`, then wrangler bundles `src/worker.ts` (resolving that import) at deploy/preview. The `ASSETS` binding and asset routing the adapter sets up are preserved because we delegate untouched requests to the generated handler.

> **Spike RESOLVED (Phase 0) — the single-worker re-export works, but needs a two-config split.**
> `@sveltejs/adapter-cloudflare` v7 treats wrangler's `main` as **its own output path**: it `rimraf`s and overwrites whatever `main` points at. So pointing `main` at `src/worker.ts` makes the adapter _clobber_ our entry. The fix that keeps everything this doc wanted (one deploy, same-origin WS):
>
> - **`wrangler.adapter.jsonc`** (build-only, passed to the adapter via `adapter({ config: 'wrangler.adapter.jsonc' })`): sets `main` + `assets` to the **default** `.svelte-kit/cloudflare/_worker.js` location. This makes the adapter build in _Workers_ mode (not Pages — it picks Pages when neither `main` nor `assets` is set) and emit `_worker.js` (+ `.assetsignore`) there, leaving `src/worker.ts` untouched.
> - **`wrangler.jsonc`** (real `main: ./src/worker.ts` + all runtime bindings): what `wrangler dev`/`deploy` and the adapter's `platformProxy` use. `src/worker.ts` re-exports the generated `_worker.js`.
>
> Two more gotchas the spike surfaced: the SvelteKit server does a dynamic `import("async_hooks")`, so the compat flag must be **`nodejs_compat`** (not just `nodejs_als`); and `tsconfig` needs **`checkJs: false`** so type-checking doesn't drown in the generated `_worker.js` + `.svelte-kit/output` JS once it exists on disk. Validated with `wrangler deploy --dry-run`. The **separate-DO-worker** layout (cross-origin WS, CORS, env-configured WS origin) remains the fallback if the seam ever breaks; keep `protocol.ts` + `rules.ts` transport-agnostic so either works. See [07](./07-local-development.md), [03](./03-realtime-and-game-logic.md).

## Request lifecycles

**Page / API request** → `worker.ts` → SvelteKit → `hooks.server.ts` (`sequence`):

1. `handleParaglide` — locale detection, sets `%paraglide.lang%`/`%paraglide.dir%`.
2. `handleSession` — ensure a guest (or real) identity; populate `event.locals.user` / `event.locals.session` / `event.locals.auth`. Requires `platform.env` bindings (D1 `DB`). See [05](./05-auth-and-sessions.md).
3. Route `load`/actions read D1 via `getDb(platform.env.DB)`, R2 via `platform.env.ASSETS_BUCKET`.

**Realtime** → `worker.ts` matches `/ws/<code>` → `GAME_ROOM` stub → DO `fetch()` does the WS upgrade (`state.acceptWebSocket`) → subsequent frames hit `webSocketMessage`/`webSocketClose`. The DO loads its state snapshot from storage, applies the event through the pure rules module, persists, and broadcasts. See [03](./03-realtime-and-game-logic.md).

## Bindings (wrangler.jsonc)

Declared in Phase 0. `hooks.server.ts` references `platform.env.DB`, so auth throws until these exist. `POOL_CACHE` (KV) is deferred until pool queries are a hotspot ([02](./02-data-model.md)); `database_id` is a placeholder locally (`db:migrate:local` uses `database_name`) — set the real id from `wrangler d1 create` before any `--remote` op ([09](./09-deployment.md)).

```jsonc
{
	"name": "footbol",
	"main": "./src/worker.ts",
	"compatibility_date": "2026-06-20",
	"compatibility_flags": ["nodejs_compat"],
	"assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "footbol-db",
			"database_id": "<id>",
			"migrations_dir": "drizzle"
		}
	],
	"r2_buckets": [{ "binding": "ASSETS_BUCKET", "bucket_name": "footbol-assets" }],
	"durable_objects": {
		"bindings": [{ "name": "GAME_ROOM", "class_name": "GameRoom" }]
	},
	"migrations": [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }],
	"triggers": { "crons": ["0 4 * * 1"] }
}
```

`wrangler.adapter.jsonc` is a separate build-only config (see the realtime-seam note above) — keep its `compatibility_*` in sync. Run `pnpm gen` (`wrangler types`) after editing bindings to regenerate the global `Env` type; `pnpm check`/`build` depend on it.

## Target repo layout

```
src/
  worker.ts                       # CF entry: /ws/* → DO, else SvelteKit; scheduled()
  hooks.server.ts                 # paraglide + session + platform guard
  hooks.ts                        # locale reroute
  app.html  app.d.ts
  lib/
    game/
      protocol.ts                 # WS message discriminated unions (shared client + DO)
      state.ts                    # GameState types + (de)serialization
      rules.ts                    # PURE state machine / reducers (node-tested)
      board.ts                    # board sampling + secret assignment (pure, seeded RNG)
    server/
      auth.ts                     # better-auth + anonymous plugin
      db/  index.ts  schema.ts  auth.schema.ts  catalog.ts
      durable/  game-room.ts      # GameRoom DO (wraps rules.ts, hibernation WS)
      ingest/  api-football.ts  sync.ts
      r2.ts                       # asset key helpers
    client/
      room-socket.svelte.ts       # WS client store (runes class)
    components/                   # Board, Card, Chat, TurnBar, GuessDialog, LangSwitcher, ...
    paraglide/                    # generated — do not edit
  routes/
    +layout.svelte  +page.svelte                 # home: create / join
    play/[code]/+page.svelte  +page.server.ts    # the game room
    how-to-play/+page.svelte
    api/rooms/+server.ts                          # POST create room
    api/dev/seed/+server.ts                       # dev-only local seeding (guarded)
scripts/   seed.ts                                # offline seed via getPlatformProxy
fixtures/  footballers.sample.json                # offline catalog for local dev
drizzle/                                          # generated SQL migrations
messages/  en.json  es.json
docs/      (this plan)
```

See [02](./02-data-model.md) for schemas, [03](./03-realtime-and-game-logic.md) for the DO + protocol, [07](./07-local-development.md) for how all of this runs on your laptop.
