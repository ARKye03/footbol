import { describe, expect, it } from 'vitest';
import { reduce, freshState, type Command } from './rules';
import type { BoardCard, GameState } from './state';

const board = (n: number): BoardCard[] =>
	Array.from({ length: n }, (_, i) => ({
		footballerId: `f${i}`,
		name: `P${i}`,
		photoKey: `players/f${i}.svg`
	}));

const lobby = (): GameState =>
	freshState(
		'ABCD',
		{ league: null, season: null, boardSize: 8, penaltyQuestions: 5 },
		board(8),
		42
	);

/** Drive a list of commands, asserting none errored unless told to; returns the final state. */
function play(state: GameState, cmds: Command[]): GameState {
	let s = state;
	let now = 0;
	for (const cmd of cmds) {
		const r = reduce(s, cmd, ++now);
		expect(r.error).toBeUndefined();
		s = r.state;
	}
	return s;
}

const ready = (): GameState =>
	play(lobby(), [
		{ t: 'join', playerId: 'a', name: 'Alice' },
		{ t: 'join', playerId: 'b', name: 'Bob' }
	]);

const playing = (): GameState => play(ready(), [{ t: 'start' }]);

describe('join', () => {
	it('stays in lobby with one player, becomes ready with two', () => {
		const one = reduce(lobby(), { t: 'join', playerId: 'a', name: 'Alice' }, 1).state;
		expect(one.phase).toBe('lobby');
		expect(one.order).toEqual(['a']);
		const two = reduce(one, { t: 'join', playerId: 'b', name: 'Bob' }, 2).state;
		expect(two.phase).toBe('ready');
		expect(two.order).toEqual(['a', 'b']);
	});

	it('rejects a duplicate and a third player', () => {
		const two = ready();
		expect(reduce(two, { t: 'join', playerId: 'a', name: 'Alice2' }, 3).error).toBe(
			'already_joined'
		);
		const third = reduce(two, { t: 'join', playerId: 'c', name: 'Carol' }, 3);
		expect(third.error).toBe('room_full');
		expect(third.state).toBe(two); // unchanged on error
	});

	it('broadcasts a system join entry', () => {
		const r = reduce(lobby(), { t: 'join', playerId: 'a', name: 'Alice' }, 1);
		expect(r.broadcast).toEqual([
			{
				t: 'patch',
				version: 1,
				chat: { id: 'c1', from: 'system', kind: 'system', text: 'joined', ts: 1 },
				phase: 'lobby'
			}
		]);
	});
});

describe('start', () => {
	it('requires two players and assigns distinct secrets that are on the board', () => {
		expect(reduce(lobby(), { t: 'start' }, 1).error).toBe('not_ready');
		const s = playing();
		expect(s.phase).toBe('playing');
		expect(s.turn).toBe('a');
		expect(s.startedAt).toBe(s.startedAt); // set
		const ids = new Set(s.board.map((c) => c.footballerId));
		expect(ids.has(s.players.a.secretId!)).toBe(true);
		expect(ids.has(s.players.b.secretId!)).toBe(true);
		expect(s.players.a.secretId).not.toBe(s.players.b.secretId);
	});

	it('rejects a second start', () => {
		expect(reduce(playing(), { t: 'start' }, 9).error).toBe('already_started');
	});
});

describe('ask / answer', () => {
	it('only the turn owner may ask, and only once until answered', () => {
		const s = playing();
		expect(reduce(s, { t: 'ask', playerId: 'b', text: 'tall?' }, 1).error).toBe('not_your_turn');
		expect(reduce(s, { t: 'ask', playerId: 'a', text: '   ' }, 1).error).toBe('empty_question');
		const asked = reduce(s, { t: 'ask', playerId: 'a', text: 'plays in defense?' }, 1).state;
		expect(asked.awaitingAnswer).toBe(true);
		expect(asked.chat.at(-1)).toMatchObject({
			from: 'a',
			kind: 'question',
			text: 'plays in defense?'
		});
		expect(reduce(asked, { t: 'ask', playerId: 'a', text: 'again?' }, 2).error).toBe(
			'awaiting_answer'
		);
	});

	it('only the opponent may answer, clearing the flag', () => {
		const asked = reduce(playing(), { t: 'ask', playerId: 'a', text: 'q' }, 1).state;
		expect(reduce(asked, { t: 'answer', playerId: 'a', value: true }, 2).error).toBe(
			'cannot_answer_own'
		);
		const answered = reduce(asked, { t: 'answer', playerId: 'b', value: false }, 2).state;
		expect(answered.awaitingAnswer).toBe(false);
		expect(answered.chat.at(-1)).toMatchObject({ from: 'b', kind: 'answer', text: 'no' });
		expect(reduce(answered, { t: 'answer', playerId: 'b', value: true }, 3).error).toBe(
			'not_awaiting_answer'
		);
	});
});

describe('endTurn', () => {
	it('rotates the turn and counts it; blocked while awaiting an answer', () => {
		const asked = reduce(playing(), { t: 'ask', playerId: 'a', text: 'q' }, 1).state;
		expect(reduce(asked, { t: 'endTurn', playerId: 'a' }, 2).error).toBe('awaiting_answer');
		const answered = reduce(asked, { t: 'answer', playerId: 'b', value: true }, 2).state;
		expect(reduce(answered, { t: 'endTurn', playerId: 'b' }, 3).error).toBe('not_your_turn');
		const ended = reduce(answered, { t: 'endTurn', playerId: 'a' }, 3).state;
		expect(ended.turn).toBe('b');
		expect(ended.turns).toBe(1);
		expect(ended.answeredThisTurn).toBe(false); // reset on rotation (issue #2)
	});

	it('rejects a pass before an ask-answer cycle (issue #2)', () => {
		expect(reduce(playing(), { t: 'endTurn', playerId: 'a' }, 1).error).toBe('must_ask_first');
	});
});

describe('flip', () => {
	it('toggles only the actor’s private eliminations', () => {
		const s = playing();
		const down = reduce(s, { t: 'flip', playerId: 'a', footballerId: 'f3', down: true }, 1).state;
		expect(down.players.a.eliminated).toEqual(['f3']);
		expect(down.players.b.eliminated).toEqual([]);
		const up = reduce(down, { t: 'flip', playerId: 'a', footballerId: 'f3', down: false }, 2).state;
		expect(up.players.a.eliminated).toEqual([]);
		expect(reduce(s, { t: 'flip', playerId: 'a', footballerId: 'nope', down: true }, 1).error).toBe(
			'unknown_card'
		);
		expect(
			reduce(s, { t: 'flip', playerId: 'a', footballerId: 'f3', down: true }, 1).broadcast
		).toEqual([]);
	});
});

/** A turn owner must ask-and-be-answered before acting (issue #2). */
const askAnswered = (state: GameState, asker: string, answerer: string): GameState =>
	play(state, [
		{ t: 'ask', playerId: asker, text: 'q' },
		{ t: 'answer', playerId: answerer, value: true }
	]);

/** A board id that is NOT the given player's secret (a guaranteed-wrong guess target). */
const wrongCard = (s: GameState, holder: string): string =>
	s.board.map((c) => c.footballerId).find((id) => id !== s.players[holder].secretId)!;

/**
 * Guess decision table (docs/11 § "Guess resolution — the two constraints", issue #3).
 * Starter S = order[0] = 'a'; Second T = order[1] = 'b'. A wrong guess never hands the
 * opponent an instant win — it opens the Penalty phase. The equalizer/penalty endpoints
 * (final winner/draw) resolve in #4/#5, so here we assert the transition only.
 */
describe('guess decision table', () => {
	it('starter + correct → equalizer for T, no winner yet (does not finish)', () => {
		const s = askAnswered(playing(), 'a', 'b');
		const target = s.players.b.secretId!;
		const r = reduce(s, { t: 'guess', playerId: 'a', footballerId: target }, 1);
		expect(r.state.phase).toBe('equalizer');
		expect(r.state.turn).toBe('b'); // order[1]
		expect(r.state.winnerId).toBeNull();
		expect(r.state.endReason).toBeNull();
		expect(r.state.penalty).toBeNull();
		expect(r.broadcast).toEqual([
			{ t: 'patch', version: r.state.version, phase: 'equalizer', turn: 'b' }
		]);
	});

	it('starter + wrong → penalty opens for T, no instant opponent win', () => {
		const s = askAnswered(playing(), 'a', 'b');
		const r = reduce(s, { t: 'guess', playerId: 'a', footballerId: wrongCard(s, 'b') }, 1);
		expect(r.state.phase).toBe('penalty');
		expect(r.state.turn).toBe('b'); // survivor = order[1] asks
		expect(r.state.winnerId).toBeNull(); // wrong guess no longer hands B the win
		expect(r.state.endReason).toBeNull();
		expect(r.state.penalty).toEqual({ asker: 'b', answerer: 'a', questionsRemaining: 5 });
		expect(r.broadcast).toEqual([
			{
				t: 'patch',
				version: r.state.version,
				phase: 'penalty',
				turn: 'b',
				penalty: { asker: 'b', answerer: 'a', questionsRemaining: 5 }
			}
		]);
	});

	it('second + correct → T wins immediately with a full secret reveal', () => {
		// Rotate the turn to T (b) and ask-answer so b may act.
		let s = askAnswered(playing(), 'a', 'b');
		s = play(s, [{ t: 'endTurn', playerId: 'a' }]);
		s = askAnswered(s, 'b', 'a');
		const target = s.players.a.secretId!;
		const r = reduce(s, { t: 'guess', playerId: 'b', footballerId: target }, 1);
		expect(r.state.phase).toBe('finished');
		expect(r.state.winnerId).toBe('b');
		expect(r.state.endReason).toBe('guess_win');
		expect(r.broadcast).toEqual([
			{
				t: 'gameOver',
				winnerId: 'b',
				reason: 'guess_win',
				secretReveal: { a: s.players.a.secretId, b: s.players.b.secretId }
			}
		]);
	});

	it('second + wrong → penalty opens for S, no instant opponent win', () => {
		let s = askAnswered(playing(), 'a', 'b');
		s = play(s, [{ t: 'endTurn', playerId: 'a' }]);
		s = askAnswered(s, 'b', 'a');
		const r = reduce(s, { t: 'guess', playerId: 'b', footballerId: wrongCard(s, 'a') }, 1);
		expect(r.state.phase).toBe('penalty');
		expect(r.state.turn).toBe('a'); // survivor = order[0] asks
		expect(r.state.winnerId).toBeNull();
		expect(r.state.endReason).toBeNull();
		expect(r.state.penalty).toEqual({ asker: 'a', answerer: 'b', questionsRemaining: 5 });
		expect(r.broadcast).toEqual([
			{
				t: 'patch',
				version: r.state.version,
				phase: 'penalty',
				turn: 'a',
				penalty: { asker: 'a', answerer: 'b', questionsRemaining: 5 }
			}
		]);
	});

	it('only the turn owner may guess', () => {
		expect(reduce(playing(), { t: 'guess', playerId: 'b', footballerId: 'f0' }, 1).error).toBe(
			'not_your_turn'
		);
	});

	it('rejects a guess before an ask-answer cycle, allows it after (issue #2)', () => {
		const s = playing();
		const target = s.players.b.secretId!;
		expect(reduce(s, { t: 'guess', playerId: 'a', footballerId: target }, 1).error).toBe(
			'must_ask_first'
		);
		const asked = reduce(s, { t: 'ask', playerId: 'a', text: 'q' }, 1).state;
		expect(reduce(asked, { t: 'guess', playerId: 'a', footballerId: target }, 2).error).toBe(
			'awaiting_answer'
		);
		const answered = reduce(asked, { t: 'answer', playerId: 'b', value: true }, 2).state;
		// S + correct now opens the equalizer rather than finishing outright.
		expect(
			reduce(answered, { t: 'guess', playerId: 'a', footballerId: target }, 3).state.phase
		).toBe('equalizer');
	});
});

/**
 * Equalizer phase (docs/11 § "Constraint 2 — Equalizer", issue #4). Reached when the
 * Starter (a) guesses correctly: T (b) is owed exactly one bare guess. Correct → draw
 * (`equalizer_draw`); wrong or decline → S keeps the win (`equalizer_held`). No Penalty.
 */
const equalizer = (): GameState => {
	const s = askAnswered(playing(), 'a', 'b');
	const target = s.players.b.secretId!;
	const r = reduce(s, { t: 'guess', playerId: 'a', footballerId: target }, 1);
	expect(r.state.phase).toBe('equalizer');
	return r.state;
};

describe('equalizer', () => {
	it('worked example 3 — T guesses correctly → equalizer_draw (winnerId null)', () => {
		const s = equalizer();
		const target = s.players.a.secretId!; // T hunts S's secret
		const r = reduce(s, { t: 'guess', playerId: 'b', footballerId: target }, 2);
		expect(r.state.phase).toBe('finished');
		expect(r.state.winnerId).toBeNull();
		expect(r.state.endReason).toBe('equalizer_draw');
		expect(r.state.turn).toBeNull();
		expect(r.broadcast).toEqual([
			{
				t: 'gameOver',
				winnerId: null,
				reason: 'equalizer_draw',
				secretReveal: { a: s.players.a.secretId, b: s.players.b.secretId }
			}
		]);
	});

	it('worked example 2 — T guesses wrong → equalizer_held (S wins, no Penalty)', () => {
		const s = equalizer();
		const r = reduce(s, { t: 'guess', playerId: 'b', footballerId: wrongCard(s, 'a') }, 2);
		expect(r.state.phase).toBe('finished');
		expect(r.state.winnerId).toBe('a'); // starterId
		expect(r.state.endReason).toBe('equalizer_held');
		expect(r.state.penalty).toBeNull(); // a wrong equalizer guess never opens Penalty
		expect(r.state.turn).toBeNull();
		expect(r.broadcast).toEqual([
			{
				t: 'gameOver',
				winnerId: 'a',
				reason: 'equalizer_held',
				secretReveal: { a: s.players.a.secretId, b: s.players.b.secretId }
			}
		]);
	});

	it('T declining via endTurn → equalizer_held (S wins)', () => {
		const s = equalizer();
		const r = reduce(s, { t: 'endTurn', playerId: 'b' }, 2);
		expect(r.state.phase).toBe('finished');
		expect(r.state.winnerId).toBe('a');
		expect(r.state.endReason).toBe('equalizer_held');
		expect(r.broadcast).toEqual([
			{
				t: 'gameOver',
				winnerId: 'a',
				reason: 'equalizer_held',
				secretReveal: { a: s.players.a.secretId, b: s.players.b.secretId }
			}
		]);
	});

	it('rejects ask during the equalizer and a guess/decline by anyone but T', () => {
		const s = equalizer();
		expect(reduce(s, { t: 'ask', playerId: 'b', text: 'q' }, 2).error).toBe('not_playing');
		// Only order[1] (b) may act; S (a) cannot guess or decline in the equalizer.
		expect(
			reduce(s, { t: 'guess', playerId: 'a', footballerId: s.players.a.secretId! }, 2).error
		).toBe('not_your_turn');
		expect(reduce(s, { t: 'endTurn', playerId: 'a' }, 2).error).toBe('not_your_turn');
	});
});

describe('forfeit', () => {
	it('hands the win to the opponent and finishes', () => {
		const r = reduce(playing(), { t: 'forfeit', playerId: 'a' }, 1);
		expect(r.state.phase).toBe('finished');
		expect(r.state.winnerId).toBe('b');
		expect(r.state.endReason).toBe('forfeit');
	});
});

describe('disconnect / reconnect', () => {
	it('marks disconnect mid-game with a grace broadcast, then restores on reconnect', () => {
		const s = reduce(
			playing(),
			{ t: 'flip', playerId: 'b', footballerId: 'f2', down: true },
			1
		).state;
		const gone = reduce(s, { t: 'disconnect', playerId: 'b' }, 2);
		expect(gone.state.players.b.connected).toBe(false);
		expect(gone.broadcast).toEqual([{ t: 'opponentLeft', graceMs: 60_000 }]);
		const back = reduce(gone.state, { t: 'reconnect', playerId: 'b' }, 3);
		expect(back.state.players.b.connected).toBe(true);
		expect(back.state.players.b.eliminated).toEqual(['f2']); // private state preserved
		expect(back.broadcast).toEqual([{ t: 'opponentBack' }]);
	});

	it('rejects unknown players and is idempotent on repeat disconnect', () => {
		const s = playing();
		expect(reduce(s, { t: 'disconnect', playerId: 'z' }, 1).error).toBe('unknown_player');
		const gone = reduce(s, { t: 'disconnect', playerId: 'b' }, 2).state;
		const again = reduce(gone, { t: 'disconnect', playerId: 'b' }, 3);
		expect(again.broadcast).toEqual([]);
		expect(again.state.players.b.connected).toBe(false);
	});
});

describe('totality', () => {
	it('never mutates state on a guard failure', () => {
		const s = playing();
		const before = structuredClone(s);
		const r = reduce(s, { t: 'ask', playerId: 'b', text: 'no' }, 1);
		expect(r.error).toBe('not_your_turn');
		expect(s).toEqual(before);
		expect(r.state).toBe(s);
	});
});

describe('full game script', () => {
	it('plays join → start → Q&A rounds → second player guesses correctly to win', () => {
		let s = playing();
		s = play(s, [
			{ t: 'ask', playerId: 'a', text: 'goalkeeper?' },
			{ t: 'answer', playerId: 'b', value: false },
			{ t: 'endTurn', playerId: 'a' },
			// b's turn: must ask-and-be-answered before guessing (issue #2)
			{ t: 'ask', playerId: 'b', text: 'midfielder?' },
			{ t: 'answer', playerId: 'a', value: true }
		]);
		expect(s.turn).toBe('b');
		expect(s.turns).toBe(1);
		// Second player (T) guessing correctly wins outright (docs/11, issue #3).
		const final = reduce(s, { t: 'guess', playerId: 'b', footballerId: s.players.a.secretId! }, 99);
		expect(final.state.phase).toBe('finished');
		expect(final.state.winnerId).toBe('b');
		expect(final.state.endReason).toBe('guess_win');
	});
});
