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

- [x] `footballer` schema finalized + indexes (done in Phase 0). ([02](./02-data-model.md))
- [x] `fixtures/footballers.sample.json` (44 across 5 leagues, season 2023). Headshots are **generated** per-player SVG avatars (initials on a deterministic gradient) — no binaries committed; `photoKey` is `players/<id>.svg` for samples, `.webp` for real sync. ([04](./04-data-ingestion.md))
- [x] `scripts/seed.ts` (`getPlatformProxy`) → local D1 + R2; `pnpm seed:local`. Generates avatars + the `_placeholder.svg` fallback. ([04](./04-data-ingestion.md))
- [x] `routes/img/[...key]/+server.ts` streams R2 (ETag/304 + immutable cache, placeholder fallback). ([06](./06-frontend.md))
- [x] `sampleBoard()` (`db/catalog.ts`) + `pools.ts` config list; `BoardCard` type added to `state.ts`. ([04](./04-data-ingestion.md))
- [x] (Optional) `ingest/api-football.ts` + `ingest/sync.ts` (`runCatalogSync`) wired to `worker.ts` `scheduled()`; `pnpm sync:local`. `API_FOOTBALL_KEY` secret declared on `Env` via `src/cloudflare.d.ts`. ([04](./04-data-ingestion.md))

**Done when:** seeded locally, a page can render a grid of real headshots from local R2. ✅ Seeded (44 rows / 5 leagues / 45 R2 objects); preview at `/catalog/[[pool]]`. `check`/`lint`/`test`/`build`/dry-run all green.

## Phase 2 — Room lifecycle & pure rules (no realtime yet)

Goal: the entire game _logic_ exists and is unit-tested, plus create/join plumbing.

- [x] `protocol.ts` (Client/Server messages, `parseClientMessage`/`encode`/`toPublicState`) + full `state.ts` types (`GameState`, `PlayerSlot`, `ChatEntry`, `Phase`, `EndReason`; added `turns`). ([03](./03-realtime-and-game-logic.md), [02](./02-data-model.md))
- [x] `board.ts`: seeded `mulberry32` + `buildBoard` + `assignSecrets` (pure, deterministic). ([03](./03-realtime-and-game-logic.md))
- [x] `rules.ts`: total `reduce` for all commands + guards + state machine; `freshState`, `toCommand`. ([03](./03-realtime-and-game-logic.md))
- [x] **Unit tests** (32): every guard, win/lose, forfeit, disconnect/reconnect, totality (no mutation on error), full-game script, secret-leak (`toPublicState`), determinism. ([08](./08-testing.md))
- [x] `POST /api/rooms`: generate code (`game/code.ts`), pick pool. **Board is built lazily by the DO on first connect** (this endpoint stores nothing); the pool travels with the creator. ([06](./06-frontend.md))
- [x] `/play/[code]` `load`: guest identity + signed `wsToken` (`server/tokens.ts`, HMAC over `BETTER_AUTH_SECRET`); static placeholder page renders pre-socket. ([05](./05-auth-and-sessions.md))

**Done when:** rules tests pass and a room code can be created/visited (static, pre-socket). ✅ `check`/`lint`/`test` (32) /`build`/dry-run all green.

> **Phase 2 decisions:** `reduce` is pure + viewer-agnostic — broadcasts are `patch`/`gameOver`/`opponentLeft`/`opponentBack`; the DO tailors per-socket `state` (Phase 3). `buildBoard` takes `BoardCard[]` (catalog already projects to it) rather than a separate `Footballer[]`. `rematch` is deferred to the DO (Phase 3) since rebuilding the board from the pool is impure. `verifyRoomToken` (in `tokens.ts`) is the DO's `hello` check, also Phase 3.

## Phase 3 — Realtime core

Goal: state syncs live between two clients through the Durable Object.

- [x] `GameRoom` DO: WS hibernation accept (tag = playerId), `webSocketMessage/Close`, storage snapshot, abandonment `alarm` (grace → opponent wins, `endReason: 'abandoned'`). ([03](./03-realtime-and-game-logic.md))
- [x] DO delegates to `reduce`; per-socket dispatch — `toPublicState` strips the opponent secret/eliminations; `opponentLeft/Back` go to the other socket only; board built lazily on first connect (`listPool` + seeded `buildBoard`). ([03](./03-realtime-and-game-logic.md))
- [x] Socket auth: `verifyRoomToken` on `hello` (asserts `userId === pid` tag + `code` match); unauth → close 4001, 3rd player → 4002. ([05](./05-auth-and-sessions.md))
- [x] `client/room-socket.svelte.ts`: connect, hello, typed intents, apply `state`/`patch`, optimistic flips (`SvelteSet`), reconnect with exponential backoff. ([06](./06-frontend.md))
- [x] DO writes `gameRecord` on finish (once, best-effort `waitUntil`). ([02](./02-data-model.md))
- [x] Realtime smoke test (`scripts/ws-smoke.ts`, `pnpm smoke:ws`): two WS clients → join, auto-start, question propagation, forfeit→gameOver, verified `gameRecord` row. ([08](./08-testing.md))

**Done when:** in `pnpm dev:full`, two windows see each other join and state changes propagate. ✅ verified via `smoke:ws` against `dev:full`; `check`/`lint`/`test` (32)/`build`/dry-run green.

> **Phase 3 security hardening:** sockets are routed by the **verified token identity** (stored in the socket attachment after `hello`), never the connection's query `pid` — an unauthenticated/mis-identified socket receives nothing, closing a pre-auth secret-disclosure hole. The RNG `seed` is **stripped from public state** (`toPublicState`), board and secret use **independent CSPRNG seeds** (the public board order can't be used to recover secrets).
>
> **Phase 3 decisions:** **auto-start** on the 2nd join (no `start` intent in the protocol; the Lobby "start" button is a Phase 4 addition if wanted). WS URL carries `pid`+`pool` (query); the token rides in `hello`. A **functional single-file** `/play/[code]` page (board/chat/turn/guess/rematch) proves the loop now; componentization (`Board`/`Card`/`Chat`/`TurnBar`/`GuessDialog`) + **Tailwind** + i18n + a11y polish are Phase 4. `vitest-pool-workers` (in-runtime DO test) deferred as CI hardening — the `smoke:ws` script covers the round-trip for now.

## Phase 4 — Gameplay MVP ← **MVP LINE**

Goal: a fun, complete game end-to-end, EN/ES, on a deployed URL.

- [x] Home `/`: name (cookie-persisted), create (pool picker), join by code/link; form actions in `+page.server.ts`. ([06](./06-frontend.md))
- [x] `Lobby` (share link + copy, code, players, waiting). Start is automatic on 2nd join. ([06](./06-frontend.md))
- [x] `GameView`: `Board`/`Card` (flip, `aria-pressed`), `Chat` (ask/answer), `TurnBar`, `GuessDialog` (modal confirm) — Tailwind-styled. ([06](./06-frontend.md))
- [x] Turn-based chat Q&A; manual private flipping (optimistic + persisted via DO state). ([03](./03-realtime-and-game-logic.md))
- [x] Final guess → win/lose; `GameOver` with secret reveal + rematch. ([03](./03-realtime-and-game-logic.md))
- [x] Reconnect restores board + eliminations (RoomSocket backoff + DO `reconnect`); `ConnectionBadge` opponent-left grace UI; fatal close (room full / unauthorized) surfaced. ([03](./03-realtime-and-game-logic.md), [06](./06-frontend.md))
- [x] All strings in `en.json` + `es.json`; `LangSwitcher`; URL-prefix locale strategy (`['url','cookie','baseLocale']`). ([06](./06-frontend.md))
- [x] Component tests on critical path (`Card`, `TurnBar`, `GameControls`, `GuessDialog`) + an **E2E happy path** (`scripts/e2e.ts`, `pnpm e2e`): two Playwright contexts → create/join, dismiss reveal, Q&A round-trip, guess, both reach game over. ([08](./08-testing.md))
- [ ] Deploy to Cloudflare; seed prod catalog — **deferred** (local-only for now; needs CF account/secrets). Tooling ready: deploy runbook ([09](./09-deployment.md)) + `pnpm seed:remote` (`scripts/seed-remote.ts` pushes the sample catalog to remote D1/R2 via `wrangler --remote`).

**Done when:** two people open a link and play a full bilingual game start to finish on the live URL — and locally. **Locally ✅** (`dev:full` + `smoke:ws` + `e2e`; bilingual UI verified EN/ES). **Live URL pending deploy.** `check`/`lint`/`test` (44)/`build`/`e2e`/dry-run green.

> **Phase 4 decisions:** display name is **cookie-persisted** (`fb_name`), not written to the auth user row — identity stays `user.id`, name is cosmetic. Home create generates the code client-redirect-side (`303 → /play/[code]?pool=`); the pool rides the query to the DO's first connect. Only remaining closeout: Cloudflare deploy + prod seed (needs real credentials).

> **Bug found by the E2E (fixed):** `ask`/`answer` broadcast a `patch` that didn't carry `awaitingAnswer`, so the answerer's UI never entered answer mode (only full `state` snapshots synced the flag; `smoke:ws` drives raw protocol so it never caught it). Fix: `patch` now carries optional `awaitingAnswer`, `reduce` sets it on ask (`true`)/answer (`false`), `room-socket` applies it.

> **Design pass (post-Phase-4):** the baseline Tailwind UI was fully restyled to an imported design (`footbol.dc.html`, claude.ai/design) — dark "FUT/EAFC" pitch theme (lime `#c6ff3a` / orange `#ff7a1a` on `#07150e`), Saira Condensed + Hanken Grotesk, theme tokens in `layout.css`. New building blocks: `lib/flags.ts` (country→emoji), `BoardCard` enriched with optional `position`/`nationality` (catalog selects them), `Reveal.svelte` (staged EAFC card reveal), `SecretCard.svelte`, `GameControls.svelte` (ask/answer footer split out of `TurnBar`), `/login` route. This work knocks out most of **Phase 5** and part of **Phase 6** (see below).

## Phase 5 — Polish

Mostly done by the design pass (see Phase 4 note). Remaining marked below.

- [x] Animations (card reveal, turn dot/ring, flood) + global `prefers-reduced-motion` kill-switch (`layout.css`).
- [ ] Full a11y pass (keyboard, `aria-live`, contrast, tap targets) — **partial**: aria contracts preserved (`aria-pressed`, `aria-live`, alertdialog), `svelte-check` a11y clean; full keyboard/contrast/tap-target audit pending. ([06](./06-frontend.md))
- [x] Mobile layout (responsive board/sidebar grid, fluid hero) — [ ] one-handed hardening pending.
- [ ] All unhappy paths — **partial**: fatal close (room full / unauthorized), opponent-left grace, login error states done; invalid/expired room, network-drop toasts pending. ([06](./06-frontend.md))
- [ ] Room expiry alarm + storage cleanup verified. ([03](./03-realtime-and-game-logic.md), [09](./09-deployment.md))
- [x] Rematch UX; copy-link — [ ] QR (skipped in design pass); sounds (optional, off by default) pending.
- [ ] Observability: lifecycle logging, dashboards, `wrangler tail` runbook. ([09](./09-deployment.md))

## Phase 6 — Beyond MVP

- [ ] **Real accounts**: email/password sign-in + sign-up via `/login` (Better Auth) **done**; [ ] guest→account history migration (`onLinkAccount`) + OAuth pending. ([05](./05-auth-and-sessions.md))
- [ ] **Stats & history**: landing has a placeholder stats strip (UI only); [ ] real per-player W/L + recent games from `gameRecord` + profile page pending.
- [ ] **Single-player vs CPU**: landing card stubbed "Coming soon"; [ ] AI opponent (yes/no answers + guessing strategy + single-player loop) pending.
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
