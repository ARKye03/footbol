// The SvelteKit Cloudflare adapter generates this module at build time
// (`vite build` → .svelte-kit/cloudflare/_worker.js). src/worker.ts re-exports
// its fetch handler, so we declare its shape for type-checking before the build
// artifact exists. See docs/01-architecture.md (the realtime seam).
declare module '*_worker.js' {
	const handler: {
		fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
	};
	export default handler;
}

// Runtime secret (docs/04): `.dev.vars` locally, `wrangler secret put` in prod.
// Declared here (not in `wrangler.jsonc` vars) so it isn't committed; merges into
// the generated `Env`. Optional — the catalog sync is the only consumer.
declare global {
	interface Env {
		API_FOOTBALL_KEY?: string;
	}
}

export {};
