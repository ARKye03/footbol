import type { LayoutServerLoad } from './$types';

/** Expose a lightweight identity to the shell header (display name + guest flag). */
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const user = locals.user;
	if (!user) return { identity: null };
	const name = cookies.get('fb_name') ?? user.name ?? '';
	return { identity: { name, guest: !user.email } };
};
