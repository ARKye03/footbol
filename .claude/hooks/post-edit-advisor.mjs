#!/usr/bin/env node
// PostToolUse(Edit|Write): keep generated types in sync with their sources.
// - wrangler config changed → auto-run `pnpm gen` (regenerates the Env type).
// - auth config changed → remind to regenerate the auth schema.
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';

const raw = await readStdin();
let data;
try {
	data = JSON.parse(raw);
} catch {
	process.exit(0);
}

const file = data?.tool_input?.file_path;
if (!file) process.exit(0);
const rel = relative(process.cwd(), file).replaceAll('\\', '/');

if (rel.endsWith('wrangler.jsonc') || rel.endsWith('wrangler.toml')) {
	try {
		execFileSync('pnpm', ['gen'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
		emit('Ran `pnpm gen` — worker-configuration.d.ts (the Env type) regenerated after the wrangler config change.');
	} catch (e) {
		emit(
			`Edited wrangler config but \`pnpm gen\` failed:\n${`${e.stdout || ''}${e.stderr || ''}`.slice(0, 1500)}\nRun \`pnpm gen\` once the config is valid so the Env type stays in sync.`
		);
	}
} else if (rel.endsWith('src/lib/server/auth.ts')) {
	emit(
		'Edited Better Auth config. If plugins/schema changed, run `pnpm auth:schema` to regenerate auth.schema.ts, then `pnpm db:generate` + a migration.'
	);
}
process.exit(0);

function readStdin() {
	return new Promise((resolve) => {
		let d = '';
		process.stdin.on('data', (c) => (d += c));
		process.stdin.on('end', () => resolve(d));
		process.stdin.on('error', () => resolve(d));
	});
}
function emit(additionalContext) {
	process.stdout.write(
		JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } })
	);
}
