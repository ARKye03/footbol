# 07 — Local Development

**The app must be fully playable on your laptop, including realtime.** The tension: `vite dev` gives fast HMR but doesn't run our custom `src/worker.ts` (so no `/ws/*` Durable Object routing); `wrangler dev` runs the real Workers runtime (DO/WS/D1/R2) but on the _built_ worker. So we use **two modes**.

## Two dev modes

|                                      | `pnpm dev` (vite)                                              | `pnpm dev:full` (wrangler)                |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------- |
| Command                              | `vite dev`                                                     | build + `wrangler dev` on `src/worker.ts` |
| HMR                                  | yes (instant)                                                  | no (rebuild to see changes)               |
| D1 / R2 / KV / auth                  | **yes** — via adapter `platformProxy` (Miniflare, local state) | yes (native)                              |
| Durable Object + live WS multiplayer | **no** (worker.ts not in the loop)                             | **yes**                                   |
| Use for                              | all UI, pages, API routes, DB/auth work — 90% of the time      | testing realtime end-to-end, two players  |

This split is the whole reason for the architecture in [01](./01-architecture.md): keep all non-realtime logic in SvelteKit so it works under `vite dev`, and isolate the realtime seam in `worker.ts` for `wrangler dev`.

### Make `vite dev` see local bindings (platformProxy)

Configure the Cloudflare adapter so `event.platform.env` is populated from local Miniflare state during `vite dev`:

```ts
// vite.config.ts
adapter: adapter({
	// build-only config so the adapter doesn't overwrite src/worker.ts (see docs/01)
	config: 'wrangler.adapter.jsonc',
	// local D1/R2/KV come from wrangler.jsonc's bindings via Miniflare state
	platformProxy: { configPath: 'wrangler.jsonc', persist: { path: '.wrangler/state/v3' } }
});
```

Now `getDb(platform.env.DB)`, `ASSETS_BUCKET`, and Better Auth all work under `vite dev` against the same local D1/R2 that `wrangler dev` uses. The only gap is the DO/WS path.

### Testing two players locally

Run `pnpm dev:full`, open the room link in **two windows** — use one normal window and one **incognito/private** window so each gets its own guest cookie (otherwise both share one identity). Or two different browsers. Create in one, join in the other.

## Environment & secrets — two files, two consumers

| File        | Read by                                                    | Contents                                                                            | Committed?                   |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| `.env`      | drizzle-kit (`db:push`/`generate`/`migrate` via `d1-http`) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`            | no (`.env.example` is)       |
| `.dev.vars` | wrangler + `getPlatformProxy` (runtime)                    | `BETTER_AUTH_SECRET`, `ORIGIN=http://localhost:5173`, `API_FOOTBALL_KEY` (optional) | no (add `.dev.vars.example`) |

> Add `.dev.vars` to `.gitignore` and create `.dev.vars.example`. `.env` is for **remote** drizzle-kit ops only; local D1 uses wrangler's local sqlite and needs no token.

## First-time setup

```sh
pnpm install
cp .env.example .env               # fill only if you'll touch the REMOTE D1
cp .dev.vars.example .dev.vars     # set BETTER_AUTH_SECRET (any 32+ chars locally), ORIGIN

# create the local D1 db + apply schema
pnpm db:generate                   # drizzle: schema.ts → drizzle/*.sql  (only when schema changed)
pnpm db:migrate:local              # wrangler d1 migrations apply footbol-db --local

# load a playable catalog with no API key
pnpm seed:local                    # fixtures → local D1 + local R2

pnpm dev                           # UI/dev work
# or
pnpm dev:full                      # full realtime, two windows
```

## package.json scripts to add (Phase 0)

```jsonc
{
	"dev:full": "vite build && wrangler dev",
	"db:migrate:local": "wrangler d1 migrations apply footbol-db --local",
	"db:migrate:remote": "wrangler d1 migrations apply footbol-db --remote",
	"seed:local": "tsx scripts/seed.ts",
	"sync:local": "tsx scripts/sync.ts" // needs API_FOOTBALL_KEY in .dev.vars
}
```

Local D1/R2 state lives under `.wrangler/state/` (gitignored). Delete that dir to reset everything; re-run migrate + seed.

## Local data operations

- **Inspect local D1**: `wrangler d1 execute footbol-db --local --command "SELECT count(*) FROM footballer"`
- **Reset DB**: `rm -rf .wrangler/state` → `pnpm db:migrate:local` → `pnpm seed:local`
- **Put an image into local R2 manually**: `wrangler r2 object put footbol-assets/players/test.webp --file=./x.webp --local`
- **Drizzle Studio** (against remote): `pnpm db:studio` (uses `.env` credentials — remote only).

## Troubleshooting

| Symptom                                          | Cause                                                            | Fix                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `D1 binding "DB" not found` under `vite dev`     | platformProxy not configured / binding missing in wrangler.jsonc | add bindings ([01](./01-architecture.md)) + `platformProxy` to adapter; `pnpm gen` |
| WS connects but nothing happens under `pnpm dev` | DO not routed in `vite dev` by design                            | use `pnpm dev:full` for realtime                                                   |
| Both browser windows act as the same player      | shared guest cookie                                              | use incognito / a second browser for player 2                                      |
| `pnpm check`/`build` type errors on `Env`        | stale generated types                                            | `pnpm gen` (wrangler types)                                                        |
| Auth redirect loops / cookie issues              | `ORIGIN` mismatch                                                | set `ORIGIN=http://localhost:5173` in `.dev.vars`                                  |
| Changes not showing in `pnpm dev:full`           | wrangler dev serves the built worker                             | rebuild (`pnpm dev:full` re-runs build) or iterate in `pnpm dev`                   |
