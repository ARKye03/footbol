import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { FootballerAttrs } from '../../game/state';

// Footballer catalog — populated by ingestion (docs/04), sampled into boards.
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
		photoKey: text('photo_key').notNull(), // R2 object key
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		attrs: text('attrs', { mode: 'json' }).$type<FootballerAttrs>(), // future structured-question data
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [
		index('footballer_league_idx').on(t.league, t.active),
		index('footballer_season_idx').on(t.season)
	]
);

// Finished-game history — written by the Durable Object at game over (docs/03).
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
		endReason: text('end_reason').notNull(), // guess_win | equalizer_held | equalizer_draw | penalty_win | penalty_draw | forfeit | abandoned (docs/11)
		turns: integer('turns').notNull().default(0),
		startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
		endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [index('game_player_idx').on(t.player1Id, t.player2Id)]
);

export * from './auth.schema';
