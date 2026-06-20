# 08 — Testing

The architecture is built for testability: game rules are pure, so the hard logic is tested without any Cloudflare runtime. Layers, cheapest first:

## 1. Unit — pure game logic (highest value)
Target: `src/lib/game/rules.ts`, `board.ts`. Runs in the existing **server** vitest project (node env). No mocks, no I/O.

- `reduce(state, cmd)` for every command and guard: ask out of turn → `error`; double answer rejected; correct guess → win; wrong guess → loss; disconnect → grace; reconnect restores; 3rd join rejected.
- `buildBoard` / `assignSecrets` are deterministic given `seed` — assert exact boards for known seeds; assert secrets are members of the board; assert distribution sanity.
- Full-game scripts: feed a sequence of commands, assert the final `GameState` and broadcasts.

```sh
pnpm test:unit -- --run --project=server src/lib/game/rules.spec.ts
```

`expect.requireAssertions` is on (`vite.config.ts`) — every test must assert.

## 2. Component — Svelte UI
Target: `Card`, `Board`, `Chat`, `TurnBar`, `GuessDialog`. Runs in the **client** vitest project (Playwright/chromium browser, `*.svelte.{test,spec}.ts`).

- Card flip toggles `aria-pressed` and visual state; emits the flip intent.
- TurnBar disables ask/guess when not your turn.
- GuessDialog requires confirmation.
- Drive components with a fake `RoomSocket` (plain object exposing the same reactive fields) so no real WS is needed.

```sh
pnpm test:unit -- --run --project=client src/lib/components/Card.svelte.spec.ts
```

## 3. Durable Object / integration (optional but recommended pre-launch)
Target: `GameRoom` end-to-end (WS upgrade, hibernation, broadcast, storage, D1 history write).

- Preferred: **`@cloudflare/vitest-pool-workers`** — runs tests *inside* the Workers runtime with real DO/D1/R2 bindings. Add as a **third, isolated vitest project** so it doesn't disturb the node/browser projects. Test: two simulated socket clients play a full game; assert broadcasts and the resulting `gameRecord` row.
- Lighter alternative: a script that runs against `pnpm dev:full` and drives two `ws` clients through a scripted game, asserting message sequences. Good as a smoke test in CI against a built worker.

## 4. E2E — two real players (stretch / pre-launch)
Playwright is already a dependency. A spec launches **two browser contexts** (separate cookies = two guests), creates a room in one, joins in the other, plays a scripted game, asserts the win screen in both. Run against `pnpm dev:full` or a preview deploy. Keep this small (one happy path + reconnect) — it's the slowest tier.

## What to test per phase
- Phase 2 (rules): tier 1 is the gate — don't move on until `reduce` is well covered.
- Phase 3 (realtime): tier 3 smoke test that a message round-trips through the DO.
- Phase 4 (MVP): tier 2 for the components on the critical path + one tier-4 happy path.

## CI
`pnpm lint && pnpm check && pnpm test && pnpm build` on every PR ([09](./09-deployment.md)). The browser project needs Playwright's chromium installed in CI (`pnpm exec playwright install --with-deps chromium`). Keep the DO/E2E tiers in a separate, possibly nightly, job if they slow PRs.
