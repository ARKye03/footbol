/**
 * WebSocket protocol (docs/03). Discriminated unions, JSON-encoded, shared verbatim
 * by the client and the Durable Object so the wire types can't drift. Pure — no
 * Cloudflare imports.
 */
import type { ChatEntry, GameState, PenaltyState, Phase, PlayerSlot } from './state';

export type ClientMessage =
	| { t: 'hello'; token: string; name: string } // session token authenticates the socket; name is the display name
	| { t: 'ask'; text: string }
	| { t: 'answer'; value: boolean }
	| { t: 'endTurn' }
	| { t: 'flip'; footballerId: string; down: boolean }
	| { t: 'guess'; footballerId: string }
	| { t: 'rematch' }
	| { t: 'leave' };

export type ServerMessage =
	| { t: 'state'; state: PublicGameState; you: string } // full snapshot (on connect / phase change)
	| {
			t: 'patch';
			version: number;
			chat?: ChatEntry;
			turn?: string | null;
			phase?: Phase;
			awaitingAnswer?: boolean;
			penalty?: PenaltyState | null; // present when entering the penalty phase (docs/11)
	  } // small deltas
	| { t: 'opponentLeft'; graceMs: number }
	| { t: 'opponentBack' }
	| { t: 'gameOver'; winnerId: string | null; reason: string; secretReveal: Record<string, string> }
	| { t: 'error'; message: string };

/** Structurally a `GameState`, but with opponent `secretId`/`eliminated` zeroed by `toPublicState`. */
export type PublicGameState = GameState;

const CLIENT_TYPES = new Set([
	'hello',
	'ask',
	'answer',
	'endTurn',
	'flip',
	'guess',
	'rematch',
	'leave'
]);

/** Parse + shallow-validate a raw client frame. Returns `null` on garbage (never throws). */
export function parseClientMessage(raw: string): ClientMessage | null {
	try {
		const msg = JSON.parse(raw);
		if (msg && typeof msg === 'object' && typeof msg.t === 'string' && CLIENT_TYPES.has(msg.t)) {
			return msg as ClientMessage;
		}
	} catch {
		// fall through
	}
	return null;
}

export const encode = (msg: ServerMessage): string => JSON.stringify(msg);

/**
 * Per-viewer projection: the viewer keeps their own secret + private eliminations;
 * the opponent's `secretId` is nulled and `eliminated` emptied. This is the secret-leak
 * guard (docs/03) — never send a player the card they're supposed to guess.
 */
export function toPublicState(state: GameState, viewerId: string): PublicGameState {
	const players: Record<string, PlayerSlot> = {};
	for (const [id, p] of Object.entries(state.players)) {
		players[id] =
			id === viewerId
				? { ...p, eliminated: [...p.eliminated] }
				: { ...p, secretId: null, eliminated: [] };
	}
	return {
		...state,
		seed: 0, // never expose the RNG seed — secrets are derivable from it (docs/03 secret-leak guard)
		board: state.board.map((c) => ({ ...c })),
		chat: state.chat.map((c) => ({ ...c })),
		order: [...state.order],
		players
	};
}
