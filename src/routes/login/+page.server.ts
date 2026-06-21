import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const NAME_COOKIE = 'fb_name';
const clean = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

/**
 * Auth screen (docs/05). Guests already have an identity (minted in hooks); signin/
 * signup go through Better Auth's email/password API, which sets the session cookie
 * via the sveltekitCookies plugin. Errors surface as a generic, non-leaky message.
 */
export const actions: Actions = {
	guest: async () => {
		redirect(303, '/');
	},

	signin: async ({ request, locals }) => {
		const form = await request.formData();
		const email = clean(form.get('email'));
		const password = clean(form.get('password'));
		if (!email || !password) return fail(400, { error: 'signin', email });
		try {
			await locals.auth.api.signInEmail({ body: { email, password }, headers: request.headers });
		} catch {
			return fail(400, { error: 'signin', email });
		}
		redirect(303, '/');
	},

	signup: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const email = clean(form.get('email'));
		const password = clean(form.get('password'));
		if (!email || !password) return fail(400, { error: 'signup', email });
		const name = cookies.get(NAME_COOKIE) || email.split('@')[0];
		try {
			await locals.auth.api.signUpEmail({
				body: { email, password, name },
				headers: request.headers
			});
		} catch {
			return fail(400, { error: 'signup', email });
		}
		redirect(303, '/');
	}
};
