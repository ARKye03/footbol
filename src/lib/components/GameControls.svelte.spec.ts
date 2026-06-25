import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GameControls from './GameControls.svelte';

const noop = () => {};
const base = {
	phase: 'playing' as const,
	answeredThisTurn: false,
	pendingQuestion: '',
	opponentName: 'Marco',
	onAsk: noop,
	onAnswer: noop,
	onEndTurn: noop,
	onStartGuess: noop
};

describe('GameControls.svelte', () => {
	it('asks a typed question on your turn', async () => {
		const onAsk = vi.fn();
		render(GameControls, { ...base, myTurn: true, awaitingAnswer: false, onAsk });
		await page.getByRole('textbox').fill('is a defender?');
		await page.getByRole('button', { name: 'Ask' }).click();
		expect(onAsk).toHaveBeenCalledWith('is a defender?');
	});

	it('hides the guess button before the act step', async () => {
		render(GameControls, {
			...base,
			myTurn: true,
			awaitingAnswer: false,
			answeredThisTurn: false
		});
		await expect
			.element(page.getByRole('button', { name: /Make my guess/ }))
			.not.toBeInTheDocument();
	});

	it('arms guess mode once answered (act step)', async () => {
		const onStartGuess = vi.fn();
		render(GameControls, {
			...base,
			myTurn: true,
			awaitingAnswer: false,
			answeredThisTurn: true,
			onStartGuess
		});
		await page.getByRole('button', { name: /Make my guess/ }).click();
		expect(onStartGuess).toHaveBeenCalledOnce();
	});

	it('answers the opponent question with Yes', async () => {
		const onAnswer = vi.fn();
		render(GameControls, {
			...base,
			myTurn: false,
			awaitingAnswer: true,
			pendingQuestion: 'European?',
			onAnswer
		});
		await page.getByRole('button', { name: 'Yes' }).click();
		expect(onAnswer).toHaveBeenCalledWith(true);
	});

	it('lets the penalty survivor ask and guess', async () => {
		const onStartGuess = vi.fn();
		render(GameControls, {
			...base,
			phase: 'penalty',
			myTurn: false,
			awaitingAnswer: false,
			penaltyRole: 'asker',
			penaltyRemaining: 5,
			onStartGuess
		});
		await expect.element(page.getByRole('textbox')).toBeInTheDocument();
		await page.getByRole('button', { name: /Guess to win/ }).click();
		expect(onStartGuess).toHaveBeenCalledOnce();
	});

	it('only answers as the out player in the penalty', async () => {
		const onAnswer = vi.fn();
		render(GameControls, {
			...base,
			phase: 'penalty',
			myTurn: false,
			awaitingAnswer: true,
			penaltyRole: 'answerer',
			pendingQuestion: 'Spanish?',
			onAnswer
		});
		await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'No' }).click();
		expect(onAnswer).toHaveBeenCalledWith(false);
	});

	it('gives the Second a single equalizer guess', async () => {
		const onStartGuess = vi.fn();
		render(GameControls, {
			...base,
			phase: 'equalizer',
			myTurn: false,
			awaitingAnswer: false,
			isSecond: true,
			onStartGuess
		});
		await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
		await page.getByRole('button', { name: /Guess to equalize/ }).click();
		expect(onStartGuess).toHaveBeenCalledOnce();
	});
});
