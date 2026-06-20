import sveltekit from '../.svelte-kit/cloudflare/_worker.js';
import { runCatalogSync } from '$lib/server/ingest/sync';

export { GameRoom } from '$lib/server/durable/game-room';

const WS_PATH = /^\/ws\/([A-Za-z0-9_-]+)$/;

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		const match = url.pathname.match(WS_PATH);
		if (match) {
			const code = match[1].toUpperCase();
			const id = env.GAME_ROOM.idFromName(code);
			return env.GAME_ROOM.get(id).fetch(request);
		}

		// everything else → SvelteKit (pages, API routes, static assets)
		return sveltekit.fetch(request, env, ctx);
	},

	async scheduled(_event, env, ctx) {
		// API-Football catalog refresh (docs/04). No-op unless API_FOOTBALL_KEY is set.
		ctx.waitUntil(runCatalogSync(env));
	}
} satisfies ExportedHandler<Env>;
