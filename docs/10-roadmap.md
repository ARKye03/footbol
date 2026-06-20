# 10 — Roadmap

Phased, each phase shippable/testable on its own. **MVP = end of Phase 4.** Phases 0–4 are the line to a playable, deployed game; 5 polishes; 6 is beyond-MVP.

Legend: `[ ]` todo. Each task links to the doc that specifies it.

## Phase 0 — Foundations & local dev (no game yet)

Goal: the scaffold runs locally with real bindings, auth works, CI is green.

- [x] Add bindings to `wrangler.jsonc`: `DB` (D1), `ASSETS_BUCKET` (R2), `GAME_ROOM` (DO); set `main: ./src/worker.ts`; DO `migrations` entry; `triggers.crons`. (`POOL_CACHE` KV deferred.) ([01](./01-architecture.md))
- [x] Create `src/worker.ts` stub: route `/ws/*` → DO (stub DO), else SvelteKit; `pnpm gen`. ([01](./01-architecture.md), [03](./03-realtime-and-game-logic.md))
- [x] **Spike DONE**: single-worker DO re-export validated via `wrangler deploy --dry-run` (all bindings resolve). Adapter v7 overwrites `main`, so the adapter builds against a separate `wrangler.adapter.jsonc`; also needs `nodejs_compat` + `checkJs: false`. Fallback (separate-DO-worker) **not** needed. ([01](./01-architecture.md))
- [x] Configure adapter `platformProxy` (+ `config: 'wrangler.adapter.jsonc'`) so `vite dev` sees local D1/R2. ([07](./07-local-development.md))
- [x] `.dev.vars.example` + `.gitignore` `.dev.vars`; document `.env` vs `.dev.vars`. ([07](./07-local-development.md))
- [x] Add scripts: `dev:full`, `db:migrate:local`, `db:migrate:remote`, `seed:local`, `sync:local` (+ `tsx` dep). ([07](./07-local-development.md))
- [x] Better Auth `anonymous` plugin; `handleSession` guarantees a guest (skips `/img`, `/ws`, `/favicon`); `pnpm auth:schema` (adds `user.isAnonymous`). ([05](./05-auth-and-sessions.md))
- [x] Replace `task` table with `footballer` + `gameRecord`; first migration (`drizzle/0000_*.sql`); `db:migrate:local` applied. ([02](./02-data-model.md))
- [x] GitHub Actions CI: build + check + test + lint (`.github/workflows/ci.yml`). ([09](./09-deployment.md))
- [x] Remove scaffold `demo/*` (auth pattern captured in [05](./05-auth-and-sessions.md)).

**Done when:** `pnpm dev` boots with a working guest session reading local D1; `pnpm dev:full` builds and serves; CI green. ✅ `check` / `test` / `lint` / dry-run all green; local D1 migrated. (`pnpm dev` / `dev:full` boot not yet smoke-tested — needs `.dev.vars`.)

## Phase 1 — Data layer & catalog

Goal: a real, query-able footballer catalog, locally with no API key.

- [ ] `footballer` schema finalized + indexes. ([02](./02-data-model.md))
- [ ] `fixtures/footballers.sample.json` (~30–50) + placeholder/sample images. ([04](./04-data-ingestion.md))
- [ ] `scripts/seed.ts` (`getPlatformProxy`) → local D1 + R2; `pnpm seed:local`. ([04](./04-data-ingestion.md))
- [ ] `routes/img/[...key]/+server.ts` streams R2 with caching. ([06](./06-frontend.md))
- [ ] `sampleBoard()` pool query + `pools.ts` config list. ([04](./04-data-ingestion.md))
- [ ] (Optional now) `api-football.ts` + `sync.ts` + `scheduled()` cron. ([04](./04-data-ingestion.md))

**Done when:** seeded locally, a page can render a grid of real headshots from local R2.

## Phase 2 — Room lifecycle & pure rules (no realtime yet)

Goal: the entire game _logic_ exists and is unit-tested, plus create/join plumbing.

- [ ] `protocol.ts`, `state.ts` types. ([03](./03-realtime-and-game-logic.md), [02](./02-data-model.md))
- [ ] `board.ts`: seeded `buildBoard` + `assignSecrets`. ([03](./03-realtime-and-game-logic.md))
- [ ] `rules.ts`: `reduce` for all commands + guards + state machine. ([03](./03-realtime-and-game-logic.md))
- [ ] **Unit tests** covering every guard, win/lose, disconnect/reconnect, full-game scripts. ([08](./08-testing.md))
- [ ] `POST /api/rooms`: generate code, pick board. ([06](./06-frontend.md))
- [ ] `/play/[code]` `load`: guest identity + `wsToken`. ([05](./05-auth-and-sessions.md))

**Done when:** rules tests pass and a room code can be created/visited (static, pre-socket).

## Phase 3 — Realtime core

Goal: state syncs live between two clients through the Durable Object.

- [ ] `GameRoom` DO: WS hibernation accept, `webSocketMessage/Close`, storage snapshot, alarm. ([03](./03-realtime-and-game-logic.md))
- [ ] DO delegates to `reduce`; per-socket dispatch (strip opponent secret; include own eliminations). ([03](./03-realtime-and-game-logic.md))
- [ ] Socket auth: validate `wsToken` on `hello`. ([05](./05-auth-and-sessions.md))
- [ ] `room-socket.svelte.ts`: connect, hello, send intents, apply state/patch, reconnect w/ backoff. ([06](./06-frontend.md))
- [ ] DO writes `gameRecord` on finish. ([02](./02-data-model.md))
- [ ] Realtime smoke test (two `ws` clients) and/or `vitest-pool-workers`. ([08](./08-testing.md))

**Done when:** in `pnpm dev:full`, two windows see each other join and state changes propagate.

## Phase 4 — Gameplay MVP ← **MVP LINE**

Goal: a fun, complete game end-to-end, EN/ES, on a deployed URL.

- [ ] Home `/`: name, create (pool picker), join by code/link. ([06](./06-frontend.md))
- [ ] `Lobby` (share link, waiting, start). ([06](./06-frontend.md))
- [ ] `GameView`: `Board`/`Card` (flip), `Chat` (ask/answer), `TurnBar`, `GuessDialog`. ([06](./06-frontend.md))
- [ ] Turn-based chat Q&A; manual private flipping (persisted via DO state). ([03](./03-realtime-and-game-logic.md))
- [ ] Final guess → win/lose; `GameOver` with secret reveal + rematch. ([03](./03-realtime-and-game-logic.md))
- [ ] Reconnect restores board + eliminations; opponent-left grace UI. ([03](./03-realtime-and-game-logic.md), [06](./06-frontend.md))
- [ ] All strings in `en.json` + `es.json`; `LangSwitcher`. ([06](./06-frontend.md))
- [ ] Component tests on critical path + one E2E happy path. ([08](./08-testing.md))
- [ ] Deploy to Cloudflare; seed prod catalog. ([09](./09-deployment.md))

**Done when:** two people open a link and play a full bilingual game start to finish on the live URL — and locally.

## Phase 5 — Polish

- [ ] Animations (card flip, turn transitions) + `prefers-reduced-motion`.
- [ ] Full a11y pass (keyboard, `aria-live`, contrast, tap targets). ([06](./06-frontend.md))
- [ ] Mobile layout hardening; one-handed play.
- [ ] All unhappy paths: invalid/expired/full room, network drops, error toasts. ([06](./06-frontend.md))
- [ ] Room expiry alarm + storage cleanup verified. ([03](./03-realtime-and-game-logic.md), [09](./09-deployment.md))
- [ ] Rematch UX; copy-link/QR; sounds (optional, off by default).
- [ ] Observability: lifecycle logging, dashboards, `wrangler tail` runbook. ([09](./09-deployment.md))

## Phase 6 — Beyond MVP

- [ ] **Real accounts**: sign-up/link from anonymous; migrate history (`onLinkAccount`); OAuth. ([05](./05-auth-and-sessions.md))
- [ ] **Stats & history**: per-player W/L, recent games from `gameRecord`; profile page.
- [ ] **Leaderboards**.
- [ ] **Public matchmaking** lobby (quick-play queue) vs current private rooms.
- [ ] **Structured-question mode**: attribute schema on `footballer.attrs`, predefined question list, server auto-evaluates yes/no, auto-flip. ([02](./02-data-model.md), [04](./04-data-ingestion.md))
- [ ] **Configurable pools UI**: leagues/eras/size picker backed by ingestion config. ([04](./04-data-ingestion.md))
- [ ] **Live API-Football refresh** + richer catalog (more leagues/seasons, transfer updates).
- [ ] Spectators, turn timers, emotes, PWA/offline shell.

## Suggested build order rationale

- **Logic before transport** (Phase 2 before 3): a pure, tested `reduce` means the DO and UI are thin and debuggable.
- **Local-first** (Phase 0 prioritizes the dual dev modes): you can't iterate on realtime without `dev:full` working early.
- **Vertical MVP** (Phase 4): ship the thinnest complete loop; defer accounts/stats/matchmaking until people are actually playing.

## Cross-cutting risks to watch

1. **The DO re-export build seam** — de-risk with the Phase 0 spike; fallback is the separate-worker layout. ([01](./01-architecture.md))
2. **WS under `vite dev`** — accepted limitation; `dev:full` is the realtime path. Don't fight it. ([07](./07-local-development.md))
3. **Secret leakage** — never send a player the `secretId` they must guess; enforce in per-socket dispatch + assert in tests. ([03](./03-realtime-and-game-logic.md))
4. **API-Football limits/cost** — keep it off the request path; cron + seed fixtures. ([04](./04-data-ingestion.md))
5. **Guest-row spam** — don't mint anonymous users on asset/health requests. ([05](./05-auth-and-sessions.md))
