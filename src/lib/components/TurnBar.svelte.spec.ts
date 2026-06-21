import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TurnBar from './TurnBar.svelte';

const noop = () => {};
const base = {
	awaitingAnswer: false,
	remaining: 12,
	guessing: false,
	opponentName: 'Marco',
	onMyPlayer: noop,
	onCancelGuess: noop
};

describe('TurnBar.svelte', () => {
	it('announces your turn and exposes the my-player button', async () => {
		const onMyPlayer = vi.fn();
		render(TurnBar, { ...base, myTurn: true, onMyPlayer });
		await expect.element(page.getByText('Your turn')).toBeInTheDocument();
		await page.getByRole('button', { name: 'My player' }).click();
		expect(onMyPlayer).toHaveBeenCalledOnce();
	});

	it("announces the opponent's turn", async () => {
		render(TurnBar, { ...base, myTurn: false });
		await expect.element(page.getByText("Opponent's turn")).toBeInTheDocument();
	});

	it('shows the guess hint and cancels guess mode', async () => {
		const onCancelGuess = vi.fn();
		render(TurnBar, { ...base, myTurn: true, guessing: true, onCancelGuess });
		await page.getByRole('button', { name: 'Cancel guess' }).click();
		expect(onCancelGuess).toHaveBeenCalledOnce();
	});
});
