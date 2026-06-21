import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GameControls from './GameControls.svelte';

const noop = () => {};
const base = {
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

	it('arms guess mode', async () => {
		const onStartGuess = vi.fn();
		render(GameControls, { ...base, myTurn: true, awaitingAnswer: false, onStartGuess });
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
});
