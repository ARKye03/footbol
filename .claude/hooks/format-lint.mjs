#!/usr/bin/env node
// PostToolUse(Edit|Write): prettier --write + eslint --fix the single edited file.
// Surfaces remaining eslint errors back to Claude. Never blocks the edit.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';

const raw = await readStdin();
let data;
try {
	data = JSON.parse(raw);
} catch {
	process.exit(0);
}

const file = data?.tool_input?.file_path;
if (!file || !existsSync(file)) process.exit(0);

const rel = relative(process.cwd(), file).replaceAll('\\', '/');
const skip =
	/(^|\/)(node_modules|\.svelte-kit|build|dist|\.wrangler)\//.test(rel) ||
	/src\/lib\/paraglide\//.test(rel) ||
	rel.endsWith('worker-configuration.d.ts') ||
	rel.endsWith('auth.schema.ts');
if (skip) process.exit(0);

if (/\.(ts|tsx|js|mjs|cjs|svelte|json|jsonc|css|md|html)$/i.test(file)) {
	try {
		execFileSync('pnpm', ['exec', 'prettier', '--write', file], { stdio: 'ignore' });
	} catch {
		/* prettier missing or unparseable — ignore */
	}
}

let eslintOut = '';
if (/\.(ts|js|mjs|cjs|svelte)$/i.test(file)) {
	try {
		execFileSync('pnpm', ['exec', 'eslint', '--fix', file], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		});
	} catch (e) {
		eslintOut = `${e.stdout || ''}${e.stderr || ''}`;
	}
}

if (eslintOut.trim()) {
	emit(
		`eslint still reports issues in ${rel} after --fix — please fix:\n${eslintOut.slice(0, 2000)}`
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
