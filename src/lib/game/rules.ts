/**
 * Pure game state machine (docs/03). No Cloudflare, no I/O — fully unit-testable.
 * `reduce` is total: it validates guards and returns the next state + the messages
 * to broadcast, or leaves state unchanged with an `error`. It NEVER throws on user
 * input. The Durable Object is a thin shell that calls this and tailors per-socket
 * `state` snapshots (Phase 3); broadcasts here are viewer-agnostic.
 */
import { assignSecrets } from './board';
import type { ClientMessage, ServerMessage } from './protocol';
import type { BoardCard, ChatEntry, ChatKind, GameConfig, GameState } from './state';

export type Command =
	| { t: 'join'; playerId: string; name: string }
	| { t: 'start' }
	| { t: 'ask'; playerId: string; text: string }
	| { t: 'answer'; playerId: string; value: boolean }
	| { t: 'endTurn'; playerId: string }
	| { t: 'flip'; playerId: string; footballerId: string; down: boolean }
	| { t: 'guess'; playerId: string; footballerId: string }
	| { t: 'forfeit'; playerId: string }
	| { t: 'disconnect'; playerId: string }
	| { t: 'reconnect'; playerId: string };

export interface Reduction {
	state: GameState;
	broadcast: ServerMessage[];
	error?: string;
}

export const GRACE_MS = 60_000;

export function freshState(
	code: string,
	config: GameConfig,
	board: BoardCard[],
	seed: number
): GameState {
	return {
		code,
		phase: 'lobby',
		config,
		board,
		players: {},
		order: [],
		starterId: '',
		turn: null,
		turns: 0,
		awaitingAnswer: false,
		answeredThisTurn: false,
		penalty: null,
		chat: [],
		winnerId: null,
		endReason: null,
		startedAt: null,
		seed,
		version: 0
	};
}

const clone = (s: GameState): GameState => structuredClone(s);
const fail = (state: GameState, error: string): Reduction => ({ state, broadcast: [], error });
const opponentId = (state: GameState, pid: string): string | null =>
	state.order.find((x) => x !== pid) ?? null;

function mkChat(
	state: GameState,
	from: string,
	kind: ChatKind,
	text: string,
	now: number
): ChatEntry {
	return { id: `c${state.version}`, from, kind, text, ts: now };
}

function secretReveal(state: GameState): Record<string, string> {
	const reveal: Record<string, string> = {};
	for (const pid of state.order) {
		const secret = state.players[pid]?.secretId;
		if (secret) reveal[pid] = secret;
	}
	return reveal;
}

const gameOver = (state: GameState): ServerMessage => ({
	t: 'gameOver',
	winnerId: state.winnerId,
	reason: state.endReason ?? 'abandoned',
	secretReveal: secretReveal(state)
});

export function reduce(state: GameState, cmd: Command, now: number): Reduction {
	switch (cmd.t) {
		case 'join': {
			if (state.players[cmd.playerId]) return fail(state, 'already_joined');
			if (state.order.length >= 2) return fail(state, 'room_full');
			const next = clone(state);
			next.players[cmd.playerId] = {
				id: cmd.playerId,
				name: cmd.name,
				secretId: null,
				connected: true,
				eliminated: []
			};
			next.order.push(cmd.playerId);
			if (next.order.length === 2) next.phase = 'ready';
			next.version++;
			const chat = mkChat(next, 'system', 'system', 'joined', now);
			next.chat.push(chat);
			return {
				state: next,
				broadcast: [{ t: 'patch', version: next.version, chat, phase: next.phase }]
			};
		}

		case 'start': {
			if (state.phase === 'lobby') return fail(state, 'not_ready');
			if (state.phase !== 'ready') return fail(state, 'already_started');
			if (state.board.length < state.order.length) return fail(state, 'board_not_ready');
			const next = clone(state);
			const secrets = assignSecrets(next.board, next.order, next.seed);
			for (const pid of next.order) next.players[pid].secretId = secrets[pid];
			next.phase = 'playing';
			next.turn = next.order[0];
			next.starterId = next.order[0];
			next.startedAt = now;
			next.awaitingAnswer = false;
			next.answeredThisTurn = false;
			next.version++;
			return {
				state: next,
				broadcast: [{ t: 'patch', version: next.version, phase: 'playing', turn: next.turn }]
			};
		}

		case 'ask': {
			// Penalty: only the survivor (asker) may ask, against their question budget
			// (docs/11 § Constraint 1). Budget exhausted with no correct guess → draw.
			if (state.phase === 'penalty') {
				const p = state.penalty!;
				if (cmd.playerId !== p.asker) return fail(state, 'not_your_turn');
				if (p.questionsRemaining <= 0) {
					// Out of questions, never guessed correctly → penalty draw.
					const next = clone(state);
					next.winnerId = null;
					next.endReason = 'penalty_draw';
					next.phase = 'finished';
					next.turn = null;
					next.awaitingAnswer = false;
					next.version++;
					return { state: next, broadcast: [gameOver(next)] };
				}
				if (state.awaitingAnswer) return fail(state, 'awaiting_answer');
				if (!cmd.text.trim()) return fail(state, 'empty_question');
				const next = clone(state);
				next.penalty!.questionsRemaining--;
				next.awaitingAnswer = true;
				next.version++;
				const chat = mkChat(next, cmd.playerId, 'question', cmd.text.trim(), now);
				next.chat.push(chat);
				return {
					state: next,
					broadcast: [
						{
							t: 'patch',
							version: next.version,
							chat,
							awaitingAnswer: true,
							penalty: next.penalty
						}
					]
				};
			}
			// No new questions in the equalizer — T is owed a bare guess (docs/11 § Constraint 2).
			if (state.phase === 'equalizer') return fail(state, 'not_playing');
			if (state.phase !== 'playing') return fail(state, 'not_playing');
			if (state.turn !== cmd.playerId) return fail(state, 'not_your_turn');
			if (state.awaitingAnswer) return fail(state, 'awaiting_answer');
			if (!cmd.text.trim()) return fail(state, 'empty_question');
			const next = clone(state);
			next.awaitingAnswer = true;
			next.version++;
			const chat = mkChat(next, cmd.playerId, 'question', cmd.text.trim(), now);
			next.chat.push(chat);
			return {
				state: next,
				broadcast: [{ t: 'patch', version: next.version, chat, awaitingAnswer: true }]
			};
		}

		case 'answer': {
			// Penalty: only the out player (answerer) answers the survivor's questions.
			if (state.phase === 'penalty') {
				const p = state.penalty!;
				if (cmd.playerId !== p.answerer) return fail(state, 'cannot_answer_own');
				if (!state.awaitingAnswer) return fail(state, 'not_awaiting_answer');
				const next = clone(state);
				next.awaitingAnswer = false;
				next.version++;
				const chat = mkChat(next, cmd.playerId, 'answer', cmd.value ? 'yes' : 'no', now);
				next.chat.push(chat);
				return {
					state: next,
					broadcast: [{ t: 'patch', version: next.version, chat, awaitingAnswer: false }]
				};
			}
			if (state.phase !== 'playing') return fail(state, 'not_playing');
			if (!state.awaitingAnswer) return fail(state, 'not_awaiting_answer');
			if (!state.players[cmd.playerId]) return fail(state, 'unknown_player');
			if (state.turn === cmd.playerId) return fail(state, 'cannot_answer_own'); // the opponent answers
			const next = clone(state);
			next.awaitingAnswer = false;
			next.answeredThisTurn = true;
			next.version++;
			const chat = mkChat(next, cmd.playerId, 'answer', cmd.value ? 'yes' : 'no', now);
			next.chat.push(chat);
			return {
				state: next,
				broadcast: [{ t: 'patch', version: next.version, chat, awaitingAnswer: false }]
			};
		}

		case 'endTurn': {
			// No passing in the penalty — the survivor must ask or guess (docs/11 § Constraint 1).
			if (state.phase === 'penalty') return fail(state, 'not_playing');
			// Declining the equalizer guess lets S's correct guess stand → S wins (docs/11 § Constraint 2).
			if (state.phase === 'equalizer') {
				const second = state.order[1];
				if (cmd.playerId !== second) return fail(state, 'not_your_turn');
				const next = clone(state);
				next.winnerId = next.starterId;
				next.endReason = 'equalizer_held';
				next.phase = 'finished';
				next.turn = null;
				next.version++;
				return { state: next, broadcast: [gameOver(next)] };
			}
			if (state.phase !== 'playing') return fail(state, 'not_playing');
			if (state.turn !== cmd.playerId) return fail(state, 'not_your_turn');
			if (state.awaitingAnswer) return fail(state, 'awaiting_answer');
			if (!state.answeredThisTurn) return fail(state, 'must_ask_first');
			const next = clone(state);
			next.turn = opponentId(next, cmd.playerId);
			next.answeredThisTurn = false;
			next.turns++;
			next.version++;
			return { state: next, broadcast: [{ t: 'patch', version: next.version, turn: next.turn }] };
		}

		case 'flip': {
			// Penalty: the survivor still narrows candidates privately; the out player can't flip.
			if (state.phase === 'penalty') {
				if (cmd.playerId !== state.penalty!.asker) return fail(state, 'not_playing');
			} else if (state.phase !== 'playing') return fail(state, 'not_playing');
			if (!state.players[cmd.playerId]) return fail(state, 'unknown_player');
			if (!state.board.some((c) => c.footballerId === cmd.footballerId))
				return fail(state, 'unknown_card');
			const next = clone(state);
			const slot = next.players[cmd.playerId];
			const has = slot.eliminated.includes(cmd.footballerId);
			if (cmd.down && !has) slot.eliminated.push(cmd.footballerId);
			else if (!cmd.down && has)
				slot.eliminated = slot.eliminated.filter((x) => x !== cmd.footballerId);
			next.version++;
			return { state: next, broadcast: [] }; // private flip; the DO acks only to the actor
		}

		case 'guess': {
			// Penalty: only the survivor (asker) may guess; the out player is done (docs/11 §
			// Constraint 1). Correct → survivor wins (penalty_win); first wrong → draw
			// (penalty_draw, default per Open Q #1). A question is not required before guessing.
			if (state.phase === 'penalty') {
				const p = state.penalty!;
				if (cmd.playerId !== p.asker) return fail(state, 'not_your_turn');
				if (state.awaitingAnswer) return fail(state, 'awaiting_answer');
				if (!state.board.some((c) => c.footballerId === cmd.footballerId))
					return fail(state, 'unknown_card');
				const next = clone(state);
				const correct = cmd.footballerId === next.players[p.answerer].secretId;
				next.winnerId = correct ? p.asker : null;
				next.endReason = correct ? 'penalty_win' : 'penalty_draw';
				next.phase = 'finished';
				next.turn = null;
				next.awaitingAnswer = false;
				next.version++;
				return { state: next, broadcast: [gameOver(next)] };
			}
			// Equalizer: S already guessed right; T (order[1]) is owed exactly one bare guess
			// (docs/11 § Constraint 2). Correct → draw; wrong → S's guess stands. No Penalty here.
			if (state.phase === 'equalizer') {
				const second = state.order[1];
				if (cmd.playerId !== second) return fail(state, 'not_your_turn');
				const opp = opponentId(state, cmd.playerId);
				if (!opp) return fail(state, 'no_opponent');
				if (!state.board.some((c) => c.footballerId === cmd.footballerId))
					return fail(state, 'unknown_card');
				const next = clone(state);
				const correct = cmd.footballerId === next.players[opp].secretId;
				next.winnerId = correct ? null : next.starterId;
				next.endReason = correct ? 'equalizer_draw' : 'equalizer_held';
				next.phase = 'finished';
				next.turn = null;
				next.awaitingAnswer = false;
				next.answeredThisTurn = false;
				next.version++;
				return { state: next, broadcast: [gameOver(next)] };
			}
			if (state.phase !== 'playing') return fail(state, 'not_playing');
			if (state.turn !== cmd.playerId) return fail(state, 'not_your_turn');
			if (state.awaitingAnswer) return fail(state, 'awaiting_answer');
			if (!state.answeredThisTurn) return fail(state, 'must_ask_first');
			const opp = opponentId(state, cmd.playerId);
			if (!opp) return fail(state, 'no_opponent');
			if (!state.board.some((c) => c.footballerId === cmd.footballerId))
				return fail(state, 'unknown_card');
			const next = clone(state);
			const correct = cmd.footballerId === next.players[opp].secretId;
			const isStarter = cmd.playerId === next.starterId;
			const [first, second] = next.order;
			next.awaitingAnswer = false;
			next.answeredThisTurn = false;
			next.version++;

			// docs/11 § "Guess resolution — the two constraints". A wrong guess never
			// hands the opponent an instant win; it opens the one-sided Penalty phase.
			// The equalizer/penalty phase handlers (resolving the win/draw) are #4/#5;
			// here we only transition INTO those phases.
			if (isStarter && correct) {
				// S guessed right: T is owed one symmetric attempt. Not a win yet.
				next.phase = 'equalizer';
				next.turn = second;
				return {
					state: next,
					broadcast: [{ t: 'patch', version: next.version, phase: 'equalizer', turn: second }]
				};
			}
			if (!isStarter && correct) {
				// T guessed right on a normal turn: wins outright, no equalizer for S.
				next.winnerId = cmd.playerId;
				next.endReason = 'guess_win';
				next.phase = 'finished';
				next.turn = null;
				return { state: next, broadcast: [gameOver(next)] };
			}
			// Wrong guess (S or T): the guesser is out, the opponent enters the Penalty phase.
			const survivor = isStarter ? second : first;
			next.phase = 'penalty';
			next.penalty = {
				asker: survivor,
				answerer: cmd.playerId,
				questionsRemaining: next.config.penaltyQuestions
			};
			next.turn = survivor;
			return {
				state: next,
				broadcast: [
					{
						t: 'patch',
						version: next.version,
						phase: 'penalty',
						turn: survivor,
						penalty: next.penalty
					}
				]
			};
		}

		case 'forfeit': {
			if (state.phase === 'finished') return fail(state, 'already_finished');
			if (!state.players[cmd.playerId]) return fail(state, 'unknown_player');
			const next = clone(state);
			next.winnerId = opponentId(next, cmd.playerId); // null if the player is alone
			next.endReason = 'forfeit';
			next.phase = 'finished';
			next.turn = null;
			next.awaitingAnswer = false;
			next.version++;
			return { state: next, broadcast: [gameOver(next)] };
		}

		case 'disconnect': {
			const slot = state.players[cmd.playerId];
			if (!slot) return fail(state, 'unknown_player');
			if (!slot.connected) return { state, broadcast: [] }; // idempotent
			const next = clone(state);
			next.players[cmd.playerId].connected = false;
			next.version++;
			const live = next.phase === 'playing' || next.phase === 'ready';
			return { state: next, broadcast: live ? [{ t: 'opponentLeft', graceMs: GRACE_MS }] : [] };
		}

		case 'reconnect': {
			const slot = state.players[cmd.playerId];
			if (!slot) return fail(state, 'unknown_player');
			const next = clone(state);
			next.players[cmd.playerId].connected = true;
			next.version++;
			return { state: next, broadcast: next.phase !== 'finished' ? [{ t: 'opponentBack' }] : [] };
		}

		default:
			return fail(state, 'unknown_command');
	}
}

/** Map an authenticated client message + its socket's player id to a `Command`. */
export function toCommand(msg: ClientMessage, playerId: string): Command | null {
	switch (msg.t) {
		case 'ask':
			return { t: 'ask', playerId, text: msg.text };
		case 'answer':
			return { t: 'answer', playerId, value: msg.value };
		case 'endTurn':
			return { t: 'endTurn', playerId };
		case 'flip':
			return { t: 'flip', playerId, footballerId: msg.footballerId, down: msg.down };
		case 'guess':
			return { t: 'guess', playerId, footballerId: msg.footballerId };
		case 'leave':
			return { t: 'forfeit', playerId };
		default:
			return null; // hello, rematch handled by the DO
	}
}
