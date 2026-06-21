import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Card from './Card.svelte';

const base = { name: 'Messi', photoKey: 'players/x.svg' };

describe('Card.svelte', () => {
	it('exposes flip state via aria-pressed and a descriptive label', async () => {
		render(Card, { ...base, down: false, onActivate: () => {} });
		const btn = page.getByRole('button');
		await expect.element(btn).toHaveAttribute('aria-pressed', 'false');
		await expect.element(btn).toHaveAccessibleName('Flip down Messi');
	});

	it('flips the label + aria-pressed when down', async () => {
		render(Card, { ...base, down: true, onActivate: () => {} });
		const btn = page.getByRole('button');
		await expect.element(btn).toHaveAttribute('aria-pressed', 'true');
		await expect.element(btn).toHaveAccessibleName('Flip up Messi');
	});

	it('switches to a guess affordance (no aria-pressed) in guess mode', async () => {
		render(Card, { ...base, guessing: true, onActivate: () => {} });
		const btn = page.getByRole('button');
		await expect.element(btn).toHaveAccessibleName('Guess Messi');
		await expect.element(btn).not.toHaveAttribute('aria-pressed');
	});

	it('calls onActivate when clicked', async () => {
		const onActivate = vi.fn();
		render(Card, { ...base, onActivate });
		await page.getByRole('button').click();
		expect(onActivate).toHaveBeenCalledOnce();
	});
});
