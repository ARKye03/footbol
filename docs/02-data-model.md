# 02 — Data Model

Three storage layers, each with a clear owner:

- **D1** — durable relational data: footballer **catalog**, finished-game **history**, Better Auth **identity** tables.
- **Durable Object storage** — the **live** state of one room while it's being played.
- **R2** — footballer **headshot** images.
- **KV** (optional) — cached pool/board query results.

## D1 schema (Drizzle, `src/lib/server/db/schema.ts`)

Existing scaffold has a throwaway `task` table — replace it. Auth tables stay in `auth.schema.ts` (generated, re-exported).

```ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// --- Footballer catalog (populated by ingestion, docs/04) ---
export const footballer = sqliteTable(
	'footballer',
	{
		id: text('id').primaryKey(), // stable id, e.g. `af:<apiFootballPlayerId>`
		name: text('name').notNull(), // display name
		fullName: text('full_name'),
		nationality: text('nationality'), // ISO country name
		position: text('position'), // GK | DEF | MID | FWD
		club: text('club'),
		league: text('league').notNull(), // pool dimension
		season: integer('season'), // pool/era dimension
		birthYear: integer('birth_year'),
		photoKey: text('photo_key').notNull(), // R2 object key, see below
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		attrs: text('attrs', { mode: 'json' }).$type<FootballerAttrs>(), // future structured-question data
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => ({
		byLeague: index('footballer_league_idx').on(t.league, t.active),
		bySeason: index('footballer_season_idx').on(t.season)
	})
);

// --- Finished-game history (written by the DO at game over, docs/03) ---
export const gameRecord = sqliteTable(
	'game_record',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		roomCode: text('room_code').notNull(),
		poolLeague: text('pool_league'),
		poolSeason: integer('pool_season'),
		boardSize: integer('board_size').notNull(),
		player1Id: text('player1_id').notNull(), // guest/user id
		player2Id: text('player2_id').notNull(),
		winnerId: text('winner_id'), // null = abandoned/draw
		endReason: text('end_reason').notNull(), // 'correct_guess' | 'wrong_guess' | 'forfeit' | 'abandoned'
		turns: integer('turns').notNull().default(0),
		startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
		endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => ({ byPlayer: index('game_player_idx').on(t.player1Id, t.player2Id) })
);

export * from './auth.schema';
```

`FootballerAttrs` (in `src/lib/game/state.ts`) is a forward-looking shape for the post-MVP structured-question mode — booleans/enums like `wonBallonDor`, `confederation`, `preferredFoot`. MVP ignores it; ingestion fills what it can.

### Migrations

- Author schema in `schema.ts` → `pnpm db:generate` writes SQL into `drizzle/`.
- `drizzle/` is wrangler's `migrations_dir`. Apply with wrangler so local and remote share the same tracked migrations:
  - local: `wrangler d1 migrations apply footbol-db --local`
  - remote: `wrangler d1 migrations apply footbol-db --remote`
- `pnpm db:push` (drizzle-kit `d1-http`) is for **quick remote prototyping only**; don't use it as the source of truth once migrations exist. Full commands in [07](./07-local-development.md).

## Durable Object state (`src/lib/game/state.ts`)

Held in the DO's in-memory object and persisted to `state.storage` under key `"game"`. Pure types — no Cloudflare imports — so the rules module and tests can use them.

```ts
export type Phase = 'lobby' | 'ready' | 'playing' | 'guessing' | 'finished';

export interface BoardCard {
	footballerId: string;
	name: string;
	photoKey: string;
}

export interface PlayerSlot {
	id: string; // guest/user id
	name: string; // display name
	secretId: string | null; // the card the OPPONENT must guess (assigned at start)
	connected: boolean;
	eliminated: string[]; // footballerIds this player has flipped down (private)
}

export interface ChatEntry {
	id: string;
	from: string;
	kind: 'question' | 'answer' | 'system';
	text: string;
	ts: number;
}

export interface GameState {
	code: string;
	phase: Phase;
	config: { league: string | null; season: number | null; boardSize: number };
	board: BoardCard[]; // shared, both players see this
	players: Record<string, PlayerSlot>; // keyed by player id (max 2)
	order: string[]; // [player1Id, player2Id] for turn rotation
	turn: string | null; // whose turn (player id)
	chat: ChatEntry[];
	winnerId: string | null;
	endReason: GameRecord['endReason'] | null;
	startedAt: number | null;
	seed: number; // RNG seed for reproducible board/secret tests
	version: number; // increments per applied event (optimistic sync / dedupe)
}
```

Notes:

- `eliminated` is private per player. The DO sends each socket only its own eliminations (plus shared state). Cards flipped are persisted so a reconnect restores the board.
- `version` lets clients drop stale/duplicate broadcasts and lets the DO send deltas.
- Storage strategy: write the whole `GameState` JSON on each mutation (rooms are small). Optimize to deltas only if needed. A DO **alarm** handles room expiry (e.g. delete storage 6h after creation) and disconnect grace periods.

## R2 layout

```
footbol-assets/
  players/<footballerId>.webp        # headshot, normalized to webp ~256px
  players/_placeholder.webp          # fallback when a headshot is missing
```

`photoKey` in D1 = the object key (`players/af:1234.webp`). Serving options:

- **MVP**: a SvelteKit route `routes/img/[...key]/+server.ts` streams from `platform.env.ASSETS_BUCKET.get(key)` with long `Cache-Control` + `ETag`. Simple, works in `vite dev` via platformProxy.
- **Later**: bind a custom R2 domain / public bucket and reference directly.

## KV (optional, `POOL_CACHE`)

Cache the result of "give me a board of size N for league/season X" since the catalog changes rarely. Key `pool:<league>:<season>:<size>` → JSON array of candidate ids; TTL ~1 day; bust on ingestion. Skip until pool queries show up as a hotspot — D1 reads at the edge are already fast.

## Identity tables

Generated by Better Auth into `auth.schema.ts` via `pnpm auth:schema` (user, session, account, verification). The `anonymous` plugin reuses these — guests are rows in `user` flagged anonymous. Player ids stored in `gameRecord` / DO `PlayerSlot.id` are these user ids. See [05](./05-auth-and-sessions.md).
