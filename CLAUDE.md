# CLAUDE.md

Guide Claude Code (claude.ai/code) for code this repo.

## Project

**footbol** — web, real-time multiplayer "Quién es quién" (Guess Who?) for football/soccer players. Two players join private room, each get secret player, take turns asking Yes/No questions to eliminate candidates till guess opponent.

Target runtime: Cloudflare edge — WebSockets + Durable Objects for live room sync, D1 persistence, R2 headshots, API-Football for player data. **MVP shipped locally (Phases 0–4, docs/10):** real `GameRoom` DO (WS hibernation), pure `rules.ts` state machine, board + private flips + chat Q&A + guess/reveal/rematch UI, guest auth + `/login`, dark FUT redesign, EN/ES, catalog ingestion. Verified locally via `dev:full` + `smoke:ws` + `e2e`. **Advanced match rules shipped (ms-1):** `rules.ts` implements the `docs/11` spec — `starterId`, `penalty` + `equalizer` phases, draw outcomes (`penalty_draw`/`equalizer_held`/etc.); no longer the simple win/lose model. **Deferred:** Cloudflare deploy + prod seed (needs CF creds). `demo/` routes removed.

## Implementation plan

Full build plan in **`docs/`** — read before building game features so build _to_ recorded decisions, not re-derive.

- [`docs/README.md`](docs/README.md) — index + locked decisions (one Worker, Durable Object re-exported from `src/worker.ts`; guests via Better Auth `anonymous` plugin; free-chat MVP questions; pure testable rules module).
- [`docs/10-roadmap.md`](docs/10-roadmap.md) — phased tasks; **MVP = end of Phase 4**. Phase 0 wires missing bindings + dual local-dev modes.
- [`docs/07-local-development.md`](docs/07-local-development.md) — `vite dev` (platformProxy, no live WS) vs `pnpm dev:full` (`wrangler dev`, real Durable Object multiplayer).
- [`docs/11-game-rules.md`](docs/11-game-rules.md) — match rules (penalty phase, first-mover equalizer, draws). **Now implemented** in `rules.ts` (ms-1); doc still labels itself "target spec" but the code matches it.

## Commands

Package manager **pnpm**. Use it, not npm/yarn.

```sh
pnpm dev                 # vite dev server
pnpm dev:full            # vite build + wrangler dev — real Durable Object multiplayer
pnpm build               # wrangler types --check, then vite build
pnpm preview             # run the built worker locally via wrangler dev
pnpm check               # wrangler types --check + svelte-kit sync + svelte-check
pnpm lint                # prettier --check + eslint
pnpm format              # prettier --write
pnpm gen                 # wrangler types -> regenerate worker-configuration.d.ts (Env type)

pnpm test                # run all vitest projects once (CI mode)
pnpm test:unit           # vitest watch mode
pnpm test:unit -- --run --project=server          # only the server (node) project
pnpm test:unit -- --run --project=client          # only the client (browser) project
pnpm test:unit -- --run src/path/to/file.spec.ts  # a single file
pnpm smoke:ws            # raw two-client WebSocket protocol smoke test (needs dev:full running)
pnpm e2e                 # vite build + two-context Playwright happy-path

pnpm db:push             # push drizzle schema to D1 (no migration files)
pnpm db:generate         # generate SQL migration from schema changes
pnpm db:migrate          # apply migrations to D1
pnpm db:migrate:local    # apply migrations to local D1 (wrangler; no creds needed)
pnpm db:studio           # drizzle studio
pnpm seed:local          # seed sample footballers + headshots into local D1/R2
pnpm sync:local          # pull real players from API-Football -> local D1/R2 (needs API_FOOTBALL_KEY)
pnpm auth:schema         # regenerate src/lib/server/db/auth.schema.ts from auth config
```

`wrangler types` output (`worker-configuration.d.ts`) = source of global `Env` type, set in `tsconfig` `types`. Run `pnpm gen` after changing `wrangler.jsonc` bindings, else `pnpm check`/`build` fail.

## Architecture

**SvelteKit on Cloudflare Workers** (`@sveltejs/adapter-cloudflare`, workers target). Built worker entry `.svelte-kit/cloudflare/_worker.js`. **Svelte 5 runes forced on** for all project (non-`node_modules`) files via `compilerOptions.runes` predicate in `vite.config.ts`.

### Request pipeline (`src/hooks.server.ts`)

`sequence(handleParaglide, handleBetterAuth)`:

1. **handleParaglide** runs `paraglideMiddleware`, replaces `%paraglide.lang%` / `%paraglide.dir%` in `app.html`.
2. **handleBetterAuth** requires D1 binding `DB` on `event.platform.env`, builds per-request auth instance with `createAuth(env.DB)`, stores on `event.locals.auth`, populates `event.locals.user` / `event.locals.session` from session.

`src/hooks.ts` `reroute` de-localizes URL pathname so locale-prefixed routes resolve same route tree.

### Auth (`src/lib/server/auth.ts`)

better-auth (`betterAuth/minimal`) with Drizzle D1 adapter, email/password on. **Auth per-request** — always use `event.locals.auth`, never import module-level `auth` export (it `createAuth(null!)` dummy, exists only so better-auth CLI generate schema). Config reads `ORIGIN` (baseURL) + `BETTER_AUTH_SECRET` from `$env/dynamic/private`. Server-side auth calls go through `auth.api.*` (e.g. `signInAnonymous`, `signInEmail`, `signOut`, `getSession`). `anonymous` plugin on; `handleSession` (`hooks.server.ts`) mints guest so `event.locals.user` always set (skips `/img`, `/ws`, `/favicon` to avoid junk rows).

### Database (`src/lib/server/db/`)

Drizzle ORM over **Cloudflare D1**. `getDb(d1)` wraps runtime `D1Database`; D1 only reachable via `event.platform.env.DB`, so DB access lives in server hooks/load/actions, not module top level. `schema.ts` holds app tables (`footballer`, `gameRecord`), re-exports `auth.schema.ts` (generated by `pnpm auth:schema` — no hand-edit). Migration flow: edit `schema.ts` → `pnpm db:generate` (writes `drizzle/*.sql`; offline, but `drizzle.config.ts` _throws_ unless `CLOUDFLARE_*` env vars present — dummy values fine for generate) → `pnpm db:migrate:local` (wrangler, no creds needed). `db:*:remote`/`db:studio` need real `CLOUDFLARE_ACCOUNT_ID`/`_DATABASE_ID`/`_D1_TOKEN`.

> **Worker build seam (docs/01):** adapter-cloudflare v7 overwrites whatever `main` points at, so builds against separate **`wrangler.adapter.jsonc`** (emits `.svelte-kit/cloudflare/_worker.js`) while `wrangler.jsonc` (`main: ./src/worker.ts` + bindings) drives dev/deploy. `src/worker.ts` re-exports that worker + routes `/ws/*` → `GAME_ROOM` DO. Needs `nodejs_compat` + `tsconfig` `checkJs: false`. Keep two configs' `compatibility_*` in sync.

### i18n (Paraglide)

`project.inlang/settings.json` — baseLocale `en`, locales `en`/`es`. Edit messages in `messages/en.json` + `messages/es.json`. Vite plugin compiles into `src/lib/paraglide/` (generated — **never edit**, import from `$lib/paraglide/messages` + `$lib/paraglide/runtime`).

### Testing

Two vitest projects in `vite.config.ts`: **client** (Playwright/chromium browser env, matches `*.svelte.{test,spec}.{js,ts}`) + **server** (node env, rest, excludes `*.svelte.*`). `expect.requireAssertions` on — every test must assert.

## Repo automation (`.claude/`)

Hooks in `.claude/settings.json` act on every Edit/Write — expect this:

- **Edits to generated/secret files denied** (`guard-protected.mjs`): `src/lib/paraglide/**`, `auth.schema.ts`, `worker-configuration.d.ts`, `.svelte-kit/**`, `.env*` (except `*.example`), `.dev.vars`, `pnpm-lock.yaml`. No hand-edit — change source, run regen (`pnpm gen`, `pnpm auth:schema`, edit `messages/{en,es}.json`, use `pnpm`).
- **Edited files auto-formatted/linted** (`format-lint.mjs`: prettier `--write` + eslint `--fix`); unfixable eslint errors reported back.
- **Editing `wrangler.jsonc` auto-runs `pnpm gen`**; editing `src/lib/server/auth.ts` reminds run `pnpm auth:schema` (`post-edit-advisor.mjs`).

Use **`runes-reviewer`** subagent (`.claude/agents/`) after writing Svelte — flags Svelte 4 leftovers (runes mode forced), runs autofixer.

## Svelte MCP server

Svelte MCP server with Svelte 5 / SvelteKit docs. Use it:

1. **list-sections** — call FIRST for any Svelte/SvelteKit question to discover doc sections (returns titles, use_cases, paths).
2. **get-documentation** — fetch full content for relevant sections found above (analyze `use_cases`, fetch ALL relevant).
3. **svelte-autofixer** — run on any Svelte code you write BEFORE showing; keep calling till no issues/suggestions remain.
4. **playground-link** — only after code done AND user confirm, NEVER for code already written to project files.
