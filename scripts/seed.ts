/**
 * Offline seed (docs/04). No API key needed.
 *
 * Reads `fixtures/footballers.sample.json`, generates a deterministic SVG avatar
 * per footballer, uploads it to **local** R2, and upserts the row into **local**
 * D1 — both reached via wrangler's `getPlatformProxy` (Miniflare state under
 * `.wrangler/state/`). Run with `pnpm seed:local`.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import type { FootballerAttrs } from '../src/lib/game/state';
import { getDb } from '../src/lib/server/db/index';
import { footballer } from '../src/lib/server/db/schema';
import { PLACEHOLDER_KEY } from '../src/lib/server/r2';

interface SeedPlayer {
	id: string;
	name: string;
	fullName?: string;
	nationality?: string;
	position?: string;
	club?: string;
	league: string;
	season?: number;
	birthYear?: number;
	photoKey: string;
	attrs?: FootballerAttrs;
}

const here = dirname(fileURLToPath(import.meta.url));
const SVG_TYPE = 'image/svg+xml; charset=utf-8';

const fnv = (s: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

const initials = (name: string): string =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? '')
		.join('');

/** Deterministic headshot stand-in: initials on a per-player gradient. */
function avatarSvg(name: string, seed: string): string {
	const hue = fnv(seed) % 360;
	const a = `hsl(${hue} 58% 44%)`;
	const b = `hsl(${(hue + 38) % 360} 60% 28%)`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${name}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="100" r="46" fill="rgba(255,255,255,0.18)"/><rect x="58" y="158" width="140" height="80" rx="40" fill="rgba(255,255,255,0.18)"/><text x="128" y="138" font-family="system-ui,Arial,sans-serif" font-size="84" font-weight="700" fill="#fff" text-anchor="middle">${initials(name)}</text></svg>`;
}

const placeholderSvg = (): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="No headshot"><rect width="256" height="256" fill="#3f3f46"/><circle cx="128" cy="100" r="46" fill="rgba(255,255,255,0.22)"/><rect x="58" y="158" width="140" height="80" rx="40" fill="rgba(255,255,255,0.22)"/></svg>`;

async function main() {
	const file = resolve(here, '../fixtures/footballers.sample.json');
	const players: SeedPlayer[] = JSON.parse(await readFile(file, 'utf8'));

	const { env, dispose } = await getPlatformProxy<Env>();
	try {
		const db = getDb(env.DB);
		const enc = new TextEncoder();

		await env.ASSETS_BUCKET.put(PLACEHOLDER_KEY, enc.encode(placeholderSvg()), {
			httpMetadata: { contentType: SVG_TYPE }
		});

		for (const p of players) {
			await env.ASSETS_BUCKET.put(p.photoKey, enc.encode(avatarSvg(p.name, p.id)), {
				httpMetadata: { contentType: SVG_TYPE }
			});

			const { id, ...rest } = { ...p, active: true, updatedAt: new Date() };
			await db
				.insert(footballer)
				.values({ id, ...rest })
				.onConflictDoUpdate({ target: footballer.id, set: rest });
		}

		console.log(`seeded ${players.length} footballers + ${players.length + 1} R2 objects (local)`);
	} finally {
		await dispose();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
