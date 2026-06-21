/**
 * Pure game types — no Cloudflare imports, so the rules module, the Durable
 * Object, and node tests can all share them (docs/02, docs/03).
 */

/** Forward-looking structured-question data. MVP ignores it; ingestion fills what it can. */
export interface FootballerAttrs {
	wonBallonDor?: boolean;
	confederation?: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
	preferredFoot?: 'left' | 'right' | 'both';
	[key: string]: unknown;
}

/** A single footballer as shown on the shared board. Sampled from the catalog (docs/04). */
export interface BoardCard {
	footballerId: string;
	name: string;
	photoKey: string;
	position?: string | null; // GK | DEF | MID | FWD — drives the card position badge
	nationality?: string | null; // ISO country name — drives the card flag
}

export type Phase = 'lobby' | 'ready' | 'playing' | 'finished';

/** Why a game ended; persisted to `gameRecord.endReason` (docs/02). */
export type EndReason = 'correct_guess' | 'wrong_guess' | 'forfeit' | 'abandoned';

export type ChatKind = 'question' | 'answer' | 'system';

export interface ChatEntry {
	id: string;
	from: string; // playerId, or 'system'
	kind: ChatKind;
	text: string;
	ts: number;
}

export interface PlayerSlot {
	id: string; // guest/user id
	name: string; // display name
	secretId: string | null; // the card THIS player is (the opponent must guess it); assigned at start
	connected: boolean;
	eliminated: string[]; // footballerIds this player has flipped down (private)
}

export interface GameConfig {
	league: string | null;
	season: number | null;
	boardSize: number;
}

export interface GameState {
	code: string;
	phase: Phase;
	config: GameConfig;
	board: BoardCard[]; // shared, both players see this
	players: Record<string, PlayerSlot>; // keyed by player id (max 2)
	order: string[]; // [player1Id, player2Id] for turn rotation
	turn: string | null; // whose turn (player id)
	turns: number; // completed turns (rotations); persisted to gameRecord.turns
	awaitingAnswer: boolean; // an ask is outstanding; the opponent must answer before endTurn
	chat: ChatEntry[];
	winnerId: string | null;
	endReason: EndReason | null;
	startedAt: number | null;
	seed: number; // RNG seed for reproducible board/secret tests
	version: number; // increments per applied event (optimistic sync / dedupe)
}
