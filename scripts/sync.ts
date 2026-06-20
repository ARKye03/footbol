/**
 * Manual local catalog sync (docs/04). Needs `API_FOOTBALL_KEY` in `.dev.vars`.
 * Populates **local** D1/R2 from API-Football without deploying. Run `pnpm sync:local`.
 */
import { getPlatformProxy } from 'wrangler';
import { runCatalogSync } from '../src/lib/server/ingest/sync';

async function main() {
	const { env, dispose } = await getPlatformProxy<Env>();
	try {
		const result = await runCatalogSync(env);
		console.log(`synced ${result.upserted} footballers across ${result.pools} pools (local)`);
	} finally {
		await dispose();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
