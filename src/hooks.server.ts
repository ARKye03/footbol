import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

// Paths that must never mint a guest row (avoids junk users on asset/health hits).
const skipSession = (path: string) =>
	path.startsWith('/img/') || path.startsWith('/ws/') || path.startsWith('/favicon');

const handleSession: Handle = async ({ event, resolve }) => {
	if (!event.platform?.env?.DB)
		throw new Error('D1 binding "DB" not found - run with wrangler/platformProxy');

	const auth = createAuth(event.platform.env.DB);
	event.locals.auth = auth;

	if (!skipSession(event.url.pathname)) {
		let session = await auth.api.getSession({ headers: event.request.headers });
		if (!session) {
			// guarantee an identity: mint an anonymous guest (cookie set via sveltekitCookies)
			await auth.api.signInAnonymous({ headers: event.request.headers });
			session = await auth.api.getSession({ headers: event.request.headers });
		}
		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleParaglide, handleSession);
