/**
 * E2E happy path (docs/08 tier 4). Two browser contexts = two guests:
 * Alice creates a room, Bob joins, both dismiss the start-of-match secret
 * reveal, a question round-trips, Alice locks in a guess, and both players
 * land on the game-over screen.
 *
 * Self-contained: starts `wrangler dev` against the freshly built worker and
 * tears it down at the end. Local D1 must be seeded (`pnpm seed:local`).
 * Run with `pnpm e2e`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright';

const PORT = 8788;
const BASE = `http://localhost:${PORT}`;

function startServer(): ChildProcess {
	return spawn('npx', ['wrangler', 'dev', '--port', String(PORT)], {
		stdio: 'ignore',
		detached: true
	});
}

async function waitForServer(timeoutMs = 45_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			if ((await fetch(BASE)).ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error('server did not become ready');
}

/** Click through the staged EAFC reveal overlay that opens when the match starts. */
async function dismissReveal(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Skip' }).click();
	await page.getByRole('button', { name: /To the board/ }).click();
}

async function main(): Promise<void> {
	const server = startServer();
	let browser: Browser | undefined;
	try {
		await waitForServer();
		browser = await chromium.launch();
		const alice = await (await browser.newContext()).newPage();
		const bob = await (await browser.newContext()).newPage();

		// Alice creates a room.
		await alice.goto(BASE);
		await alice.getByLabel('Your name').fill('Alice');
		await alice.getByRole('button', { name: /Create room/ }).click();
		await alice.waitForURL(/\/play\/[A-Z0-9]+/);
		const code = new URL(alice.url()).pathname.split('/').pop()!;
		console.log(`  room ${code} created`);

		// Bob joins by code.
		await bob.goto(BASE);
		await bob.getByLabel('Your name').fill('Bob');
		await bob.getByLabel('Room code').fill(code);
		await bob.getByRole('button', { name: 'Join' }).click();
		await bob.waitForURL(new RegExp(`/play/${code}`));
		console.log('  ✓ both joined; match auto-started');

		// Both dismiss their own secret-player reveal.
		await dismissReveal(alice);
		await dismissReveal(bob);
		console.log('  ✓ secret reveal dismissed');

		// Alice (turn 1) asks via a suggested chip; Bob answers.
		await alice.getByRole('button', { name: 'Is your player a defender?' }).click();
		await bob.getByRole('button', { name: 'Yes' }).click();
		console.log('  ✓ question round-tripped');

		// Alice makes a guess → confirm dialog → lock in → resolves the game.
		await alice.getByRole('button', { name: /Make my guess/ }).click();
		await alice.getByTestId('card').first().click();
		await alice.getByRole('button', { name: 'Lock it in' }).click();
		console.log('  ✓ guess locked in');

		// Both players reach the game-over screen (rematch is offered to both).
		await alice.getByRole('button', { name: /Rematch/ }).waitFor({ timeout: 15_000 });
		await bob.getByRole('button', { name: /Rematch/ }).waitFor({ timeout: 15_000 });
		console.log('  ✓ both reached game over');

		console.log('\nPASS — E2E happy path OK');
	} finally {
		await browser?.close();
		if (server.pid) {
			try {
				process.kill(-server.pid);
			} catch {
				/* already gone */
			}
		}
	}
}

main().catch((err) => {
	console.error('\nFAIL —', err);
	process.exit(1);
});
