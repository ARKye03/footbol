import { describe, expect, it } from 'vitest';
import { encode, parseClientMessage, toPublicState } from './protocol';
import { freshState, reduce, toCommand } from './rules';
import type { BoardCard, GameState } from './state';

const board = (n: number): BoardCard[] =>
	Array.from({ length: n }, (_, i) => ({
		footballerId: `f${i}`,
		name: `P${i}`,
		photoKey: `players/f${i}.svg`
	}));

function playing(): GameState {
	let s = freshState(
		'ABCD',
		{ league: null, season: null, boardSize: 8, penaltyQuestions: 5 },
		board(8),
		42
	);
	s = reduce(s, { t: 'join', playerId: 'a', name: 'Alice' }, 1).state;
	s = reduce(s, { t: 'join', playerId: 'b', name: 'Bob' }, 2).state;
	s = reduce(s, { t: 'start' }, 3).state;
	s = reduce(s, { t: 'flip', playerId: 'b', footballerId: 'f1', down: true }, 4).state;
	return s;
}

describe('toPublicState', () => {
	it('never leaks the opponent secret or private eliminations', () => {
		const s = playing();
		const view = toPublicState(s, 'a');
		expect(view.players.b.secretId).toBeNull();
		expect(view.players.b.eliminated).toEqual([]);
		expect(view.seed).toBe(0); // RNG seed stripped — secrets are derivable from it
		// the viewer keeps their own identity + flips
		expect(view.players.a.secretId).toBe(s.players.a.secretId);
		expect(view.players.b.name).toBe('Bob'); // non-secret fields survive
	});

	it('shows a player their own secret and eliminations', () => {
		const s = playing();
		const view = toPublicState(s, 'b');
		expect(view.players.b.secretId).toBe(s.players.b.secretId);
		expect(view.players.b.eliminated).toEqual(['f1']);
		expect(view.players.a.secretId).toBeNull();
	});

	it('does not mutate the source state', () => {
		const s = playing();
		const before = structuredClone(s);
		toPublicState(s, 'a');
		expect(s).toEqual(before);
	});
});

describe('parseClientMessage', () => {
	it('accepts known message types and rejects garbage', () => {
		expect(parseClientMessage('{"t":"ask","text":"hi"}')).toEqual({ t: 'ask', text: 'hi' });
		expect(parseClientMessage('not json')).toBeNull();
		expect(parseClientMessage('{"t":"nope"}')).toBeNull();
		expect(parseClientMessage('42')).toBeNull();
	});
});

describe('toCommand', () => {
	it('maps client intents to player-scoped commands', () => {
		expect(toCommand({ t: 'ask', text: 'q' }, 'a')).toEqual({ t: 'ask', playerId: 'a', text: 'q' });
		expect(toCommand({ t: 'leave' }, 'a')).toEqual({ t: 'forfeit', playerId: 'a' });
		expect(toCommand({ t: 'flip', footballerId: 'f0', down: true }, 'a')).toEqual({
			t: 'flip',
			playerId: 'a',
			footballerId: 'f0',
			down: true
		});
		expect(toCommand({ t: 'hello', token: 'x', name: 'Alice' }, 'a')).toBeNull();
		expect(toCommand({ t: 'rematch' }, 'a')).toBeNull();
	});
});

describe('encode', () => {
	it('round-trips a server message', () => {
		expect(JSON.parse(encode({ t: 'error', message: 'oops' }))).toEqual({
			t: 'error',
			message: 'oops'
		});
	});
});
