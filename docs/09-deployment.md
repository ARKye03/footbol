# 09 — Deployment

Single Worker deploy to Cloudflare. The build produces `_worker.js`; wrangler bundles `src/worker.ts` (which re-exports it + the `GameRoom` Durable Object) and uploads assets.

## One-time Cloudflare setup

```sh
wrangler login
wrangler d1 create footbol-db                 # → copy database_id into wrangler.jsonc
wrangler r2 bucket create footbol-assets
wrangler kv namespace create POOL_CACHE       # → copy id into wrangler.jsonc (if used)
```

Fill the ids in `wrangler.jsonc` ([01](./01-architecture.md)). The DO needs a `migrations` entry (`new_sqlite_classes: ["GameRoom"]`) — that's a _Workers_ migration (registers the class), separate from D1 migrations.

## Secrets (production)

Runtime secrets are **not** in wrangler.jsonc. Set them once per environment:

```sh
echo "<32+ random>" | wrangler secret put BETTER_AUTH_SECRET
echo "https://footbol.<you>.workers.dev" | wrangler secret put ORIGIN
echo "<api-football key>" | wrangler secret put API_FOOTBALL_KEY   # if using cron sync
```

`ORIGIN` must match the deployed URL (Better Auth base + room-token signing). Update it if you attach a custom domain.

## Database migrations (remote)

```sh
pnpm db:generate                                 # if schema changed
pnpm db:migrate:remote                           # wrangler d1 migrations apply footbol-db --remote
```

Then seed the **production** catalog by running the cron once (`wrangler` triggers) or invoking the sync against remote (`scripts/sync.ts` pointed at remote bindings, with a real `API_FOOTBALL_KEY`). Never ship with an empty catalog — the board needs players.

## Deploy

```sh
pnpm build          # wrangler types --check + vite build → .svelte-kit/cloudflare/_worker.js
wrangler deploy     # bundles src/worker.ts (+ DO) and uploads assets
```

`pnpm preview` (wrangler dev on the built worker) is the last local gate before deploy.

## Environments

Use wrangler **environments** for staging vs production (`[env.staging]` blocks: distinct `name`, D1 db, R2 bucket, secrets). Deploy with `wrangler deploy --env staging`. Keeps prod data clean while testing migrations/ingestion.

## CI/CD (GitHub Actions sketch)

```yaml
# .github/workflows/ci.yml
on: [pull_request, push]
jobs:
  verify:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm exec playwright install --with-deps chromium
      - pnpm lint
      - pnpm check
      - pnpm test
      - pnpm build
  deploy: # on push to main only
    needs: verify
    steps:
      - pnpm install --frozen-lockfile
      - run: pnpm db:migrate:remote # env: CLOUDFLARE_* from repo secrets
      - uses: cloudflare/wrangler-action # env: CLOUDFLARE_API_TOKEN
        with: { command: deploy }
```

Store `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the D1 credentials as GitHub Actions secrets. The deploy token needs Workers + D1 + R2 + KV edit scopes.

## Cron (catalog refresh)

`triggers.crons` in wrangler.jsonc ([01](./01-architecture.md)) fires `worker.ts` `scheduled()` → `runCatalogSync(env)` ([04](./04-data-ingestion.md)). Weekly is fine. Test locally with `wrangler dev --test-scheduled` then hit the scheduled endpoint.

## Observability

- `wrangler tail` for live logs (DO + worker).
- Workers dashboard: requests, errors, DO invocations/duration, D1 query stats.
- Add structured `console.log` of game lifecycle events (room created, started, finished, abandoned) — cheap, invaluable for debugging realtime.
- Watch DO storage/alarm behavior: ensure rooms actually expire (no leaked storage) and grace alarms fire.

## Cost notes

Hibernating DOs, edge D1, zero-egress R2, and Workers free tier keep an MVP effectively free. The realistic cost drivers later: DO duration under heavy concurrency and API-Football plan tier — both controllable.
