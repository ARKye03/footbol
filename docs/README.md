# footbol — Implementation Plan

Real-time, two-player "¿Quién es quién?" (Guess Who?) for football players. Built on SvelteKit + Cloudflare edge (Workers, Durable Objects, D1, R2), i18n in English/Spanish via Paraglide.

These docs are the full build plan: what to build, why, and how to run it locally. Read in order for onboarding; jump by topic once familiar.

| #   | Doc                                                      | What it covers                                                 |
| --- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 00  | [Overview](./00-overview.md)                             | Vision, game rules, glossary, MVP definition                   |
| 01  | [Architecture](./01-architecture.md)                     | System design, data flow, tech rationale, target repo layout   |
| 02  | [Data Model](./02-data-model.md)                         | D1 schema, Durable Object state, R2/KV layout, migrations      |
| 03  | [Realtime & Game Logic](./03-realtime-and-game-logic.md) | Durable Object, WebSocket protocol, pure rules state machine   |
| 04  | [Data Ingestion](./04-data-ingestion.md)                 | API-Football sync, R2 image pipeline, offline seed fixtures    |
| 05  | [Auth & Sessions](./05-auth-and-sessions.md)             | Anonymous guests (Better Auth), cookies, upgrade path          |
| 06  | [Frontend](./06-frontend.md)                             | Routes, components, client WS store, i18n, UX, a11y            |
| 07  | [Local Development](./07-local-development.md)           | Dual dev modes, bindings, local D1/R2 seeding, troubleshooting |
| 08  | [Testing](./08-testing.md)                               | Unit / component / Durable Object / E2E strategy               |
| 09  | [Deployment](./09-deployment.md)                         | Environments, secrets, CI/CD, cron, observability              |
| 10  | [Roadmap](./10-roadmap.md)                               | Phases 0–6, MVP cut line, task checklists                      |

## TL;DR for a new contributor

```sh
pnpm install
cp .env.example .env            # drizzle-kit: CLOUDFLARE_* + D1 token (remote ops only)
cp .dev.vars.example .dev.vars  # runtime secrets: BETTER_AUTH_SECRET, ORIGIN, API_FOOTBALL_KEY
pnpm db:migrate:local           # apply schema to local D1
pnpm seed:local                 # load sample footballers + headshots into local D1/R2
pnpm dev                        # vite dev — UI work, real local D1/R2, no live multiplayer
# For live 2-player multiplayer:
pnpm dev:full                   # build + wrangler dev — open two browser windows
```

> Scripts above are **targets defined by this plan**, not all present yet. Phase 0 ([Roadmap](./10-roadmap.md)) wires them up. The current repo is a fresh scaffold.

## Key decisions (the "why" lives in the linked docs)

- **One Worker, Durable Object re-exported** from a custom `src/worker.ts` → single deploy, same-origin WebSockets. See [01](./01-architecture.md), [03](./03-realtime-and-game-logic.md).
- **Guests via Better Auth `anonymous` plugin** → zero-friction entry now, real accounts later with one upgrade. See [05](./05-auth-and-sessions.md).
- **MVP questions are free human chat** (opponent answers yes/no; players flip cards manually). Structured auto-evaluated questions are post-MVP. See [00](./00-overview.md), [03](./03-realtime-and-game-logic.md).
- **Game rules are a pure, framework-free module** the Durable Object wraps → fully unit-testable without the Workers runtime. See [03](./03-realtime-and-game-logic.md), [08](./08-testing.md).
