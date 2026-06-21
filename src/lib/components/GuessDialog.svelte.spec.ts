import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GuessDialog from './GuessDialog.svelte';

describe('GuessDialog.svelte', () => {
	it('names the pick and confirms', async () => {
		const onConfirm = vi.fn();
		render(GuessDialog, { name: 'Haaland', onConfirm, onCancel: () => {} });
		await expect.element(page.getByRole('alertdialog')).toBeInTheDocument();
		await expect.element(page.getByText('Haaland', { exact: false })).toBeInTheDocument();
		await page.getByRole('button', { name: 'Lock it in' }).click();
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it('cancels without confirming', async () => {
		const onCancel = vi.fn();
		render(GuessDialog, { name: 'Haaland', onConfirm: () => {}, onCancel });
		await page.getByRole('button', { name: 'Cancel' }).click();
		expect(onCancel).toHaveBeenCalledOnce();
	});
});
