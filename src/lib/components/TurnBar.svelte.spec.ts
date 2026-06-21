import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TurnBar from './TurnBar.svelte';

const noop = () => {};
const base = {
	awaitingAnswer: false,
	remaining: 12,
	guessing: false,
	onAsk: noop,
	onAnswer: noop,
	onEndTurn: noop,
	onToggleGuess: noop
};

describe('TurnBar.svelte', () => {
	it('hides ask/guess controls when it is not your turn', async () => {
		render(TurnBar, { ...base, myTurn: false });
		await expect.element(page.getByText("Opponent's turn")).toBeInTheDocument();
		expect(page.getByRole('button', { name: 'Ask' }).query()).toBeNull();
		expect(page.getByRole('button', { name: 'Guess' }).query()).toBeNull();
	});

	it('shows ask + end-turn + guess on your turn and submits a question', async () => {
		const onAsk = vi.fn();
		render(TurnBar, { ...base, myTurn: true, onAsk });
		await expect.element(page.getByRole('button', { name: 'Guess' })).toBeInTheDocument();
		await page.getByRole('textbox').fill('is a defender?');
		await page.getByRole('button', { name: 'Ask' }).click();
		expect(onAsk).toHaveBeenCalledWith('is a defender?');
	});

	it('shows Yes/No to the answerer and reports the answer', async () => {
		const onAnswer = vi.fn();
		render(TurnBar, { ...base, myTurn: false, awaitingAnswer: true, onAnswer });
		await page.getByRole('button', { name: 'Yes' }).click();
		expect(onAnswer).toHaveBeenCalledWith(true);
	});
});
