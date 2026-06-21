import { error, fail, redirect } from '@sveltejs/kit';
import { generateRoomCode, isValidRoomCode } from '$lib/game/code';
import { POOLS } from '$lib/server/ingest/pools';
import type { Actions, PageServerLoad } from './$types';

const NAME_COOKIE = 'fb_name';
const cleanName = (raw: FormDataEntryValue | null, fallback: string) =>
	(typeof raw === 'string' ? raw.trim() : '').slice(0, 24) || fallback;

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const name = cookies.get(NAME_COOKIE) ?? locals.user?.name ?? '';
	return {
		name,
		pools: POOLS.map((p) => ({ id: p.id, label: p.label }))
	};
};

export const actions: Actions = {
	create: async ({ request, cookies, locals }) => {
		if (!locals.user) error(401, 'no session');
		const form = await request.formData();
		const name = cleanName(form.get('name'), locals.user.name);
		const poolId = String(form.get('pool') ?? POOLS[0].id);
		cookies.set(NAME_COOKIE, name, { path: '/', maxAge: 60 * 60 * 24 * 30 });
		const code = generateRoomCode();
		redirect(303, `/play/${code}?pool=${encodeURIComponent(poolId)}`);
	},

	join: async ({ request, cookies, locals }) => {
		if (!locals.user) error(401, 'no session');
		const form = await request.formData();
		const name = cleanName(form.get('name'), locals.user.name);
		const code = String(form.get('code') ?? '')
			.trim()
			.toUpperCase();
		if (!isValidRoomCode(code)) return fail(400, { codeError: true, name });
		cookies.set(NAME_COOKIE, name, { path: '/', maxAge: 60 * 60 * 24 * 30 });
		redirect(303, `/play/${code}`);
	}
};
