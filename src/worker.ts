import sveltekit from '../.svelte-kit/cloudflare/_worker.js';

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

	async scheduled(_event, _env, _ctx) {
		// Phase 1: ctx.waitUntil(runCatalogSync(env)) — API-Football refresh (docs/04)
	}
} satisfies ExportedHandler<Env>;
