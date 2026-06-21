/**
 * Remote (production) catalog seed (docs/09). The offline `seed.ts` writes to
 * local Miniflare state via `getPlatformProxy`; this one targets the **deployed**
 * D1 + R2 through `wrangler --remote`. Same sample fixtures + generated SVG avatars.
 *
 * Prereqs: `wrangler login`, real `database_id` in wrangler.jsonc, the R2 bucket
 * created, D1 migrations applied (`pnpm db:migrate:remote`). Run: `pnpm seed:remote`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FootballerAttrs } from '../src/lib/game/state';
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
const DB = 'footbol-db';
const BUCKET = 'footbol-assets';

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

function avatarSvg(name: string, seed: string): string {
	const hue = fnv(seed) % 360;
	const a = `hsl(${hue} 58% 44%)`;
	const b = `hsl(${(hue + 38) % 360} 60% 28%)`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${name}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="100" r="46" fill="rgba(255,255,255,0.18)"/><rect x="58" y="158" width="140" height="80" rx="40" fill="rgba(255,255,255,0.18)"/><text x="128" y="138" font-family="system-ui,Arial,sans-serif" font-size="84" font-weight="700" fill="#fff" text-anchor="middle">${initials(name)}</text></svg>`;
}

const placeholderSvg = (): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="No headshot"><rect width="256" height="256" fill="#3f3f46"/><circle cx="128" cy="100" r="46" fill="rgba(255,255,255,0.22)"/><rect x="58" y="158" width="140" height="80" rx="40" fill="rgba(255,255,255,0.22)"/></svg>`;

const sql = (v: string | number | null): string =>
	v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;

function wrangler(args: string[]): void {
	execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit' });
}

function main() {
	const players: SeedPlayer[] = JSON.parse(
		readFileSync(resolve(here, '../fixtures/footballers.sample.json'), 'utf8')
	);
	const tmp = mkdtempSync(join(tmpdir(), 'footbol-seed-'));

	// 1. D1 rows — one upsert statement per player, written to a single SQL file.
	const now = Date.now();
	const rows = players.map((p) => {
		const cols = [
			sql(p.id),
			sql(p.name),
			sql(p.fullName ?? null),
			sql(p.nationality ?? null),
			sql(p.position ?? null),
			sql(p.club ?? null),
			sql(p.league),
			sql(p.season ?? null),
			sql(p.birthYear ?? null),
			sql(p.photoKey),
			'1',
			sql(p.attrs ? JSON.stringify(p.attrs) : null),
			String(now)
		].join(',');
		return (
			`INSERT INTO footballer (id,name,full_name,nationality,position,club,league,season,birth_year,photo_key,active,attrs,updated_at) VALUES (${cols}) ` +
			`ON CONFLICT(id) DO UPDATE SET name=excluded.name,full_name=excluded.full_name,nationality=excluded.nationality,position=excluded.position,club=excluded.club,league=excluded.league,season=excluded.season,birth_year=excluded.birth_year,photo_key=excluded.photo_key,active=excluded.active,attrs=excluded.attrs,updated_at=excluded.updated_at;`
		);
	});
	const sqlFile = join(tmp, 'seed.sql');
	writeFileSync(sqlFile, rows.join('\n'), 'utf8');
	console.log(`→ upserting ${players.length} footballer rows into ${DB} (remote)`);
	wrangler(['d1', 'execute', DB, '--remote', '--file', sqlFile]);

	// 2. R2 objects — the generated avatar per player + the placeholder fallback.
	const put = (key: string, svg: string) => {
		const f = join(tmp, key.replace(/\//g, '_'));
		writeFileSync(f, svg, 'utf8');
		wrangler([
			'r2',
			'object',
			'put',
			`${BUCKET}/${key}`,
			'--file',
			f,
			'--content-type',
			SVG_TYPE,
			'--remote'
		]);
	};
	console.log(`→ uploading ${players.length + 1} R2 objects to ${BUCKET} (remote)`);
	put(PLACEHOLDER_KEY, placeholderSvg());
	for (const p of players) put(p.photoKey, avatarSvg(p.name, p.id));

	console.log(`\nseeded ${players.length} footballers + ${players.length + 1} R2 objects (remote)`);
}

main();
