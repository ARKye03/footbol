# 05 — Auth & Sessions

**Goal:** zero-friction entry — you can play without signing up — but built so real accounts plug in later without touching game code. Solution: **Better Auth with the `anonymous` plugin**. Guests are real (anonymous) users from day one, so player ids, history, and later account upgrades all use one identity model.

Better Auth is already scaffolded (`src/lib/server/auth.ts`, D1 Drizzle adapter, email/password enabled, auth tables generated). This doc adds anonymous sessions and wires identity into the request + game flow.

## Anonymous plugin

```ts
// src/lib/server/auth.ts (add to plugins)
import { anonymous } from 'better-auth/plugins';

plugins: [
  anonymous({
    // when a guest later signs up/links, migrate their data
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      // re-point game_record rows from anonymousUser.id → newUser.id (post-MVP)
    }
  }),
  sveltekitCookies(getRequestEvent) // MUST stay last
]
```

Run `pnpm auth:schema` after changing plugins to regenerate `auth.schema.ts` (the anonymous plugin may add columns/flags).

## Session hook (`src/hooks.server.ts`)

Replace the current `handleBetterAuth` with a `handleSession` that **guarantees an identity**: if there's no session, create an anonymous one so `event.locals.user` is always populated.

```ts
const handleSession: Handle = async ({ event, resolve }) => {
  if (!event.platform?.env?.DB) throw new Error('D1 binding "DB" not found - run with wrangler/platformProxy');
  const auth = createAuth(event.platform.env.DB);
  event.locals.auth = auth;

  let session = await auth.api.getSession({ headers: event.request.headers });
  if (!session) {
    // mint an anonymous guest; Better Auth sets the cookie via sveltekitCookies
    await auth.api.signInAnonymous({ headers: event.request.headers });
    session = await auth.api.getSession({ headers: event.request.headers });
  }
  if (session) { event.locals.session = session.session; event.locals.user = session.user; }

  return svelteKitHandler({ event, resolve, auth, building });
};
```

> Don't mint anonymous users for asset/health requests — guard by path (skip `/img/*`, `/favicon`, etc.) so you don't create junk rows on every image fetch.

A guest gets a generated display name (e.g. "Player-7F3A") editable on the home screen; persist the chosen name on the user row.

## Identity in the game flow

- `event.locals.user.id` is the **player id** used in DO `PlayerSlot.id`, `gameRecord`, and turn logic.
- **Socket auth** ([03](./03-realtime-and-game-logic.md)): the `/play/[code]` server `load` issues a short-lived signed token binding `{ userId, code }`. The client sends it in the WS `hello`; the DO validates it before accepting the player. This stops a client from claiming an arbitrary `playerId` over the socket.

```ts
// routes/play/[code]/+page.server.ts (sketch)
export const load: PageServerLoad = async (event) => {
  const user = event.locals.user!;                 // always present (guest or real)
  const code = event.params.code.toUpperCase();
  const wsToken = await mintRoomToken({ userId: user.id, code }, event.platform!.env);
  return { code, me: { id: user.id, name: user.name }, wsToken };
};
```

## Upgrade path (post-MVP)

Real accounts need no game-code changes: a guest signs up / links via Better Auth; `onLinkAccount` migrates history; the user id is stable enough that in-progress rooms keep working. Email/password is already enabled; add OAuth providers later purely in `auth.ts`.

## Env / secrets

- `BETTER_AUTH_SECRET` — signing secret (also used for room tokens). 32+ random chars. `.dev.vars` locally, `wrangler secret put` in prod.
- `ORIGIN` — base URL for Better Auth (`http://localhost:5173` locally, the deployed origin in prod).

Both are runtime secrets and belong in `.dev.vars` (not `.env`, which is for drizzle-kit). See [07](./07-local-development.md).
