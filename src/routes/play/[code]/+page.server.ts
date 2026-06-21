import { error } from '@sveltejs/kit';
import { isValidRoomCode } from '$lib/game/code';
import { mintRoomToken } from '$lib/server/tokens';
import type { PageServerLoad } from './$types';

/**
 * Game-room entry (docs/05). `handleSession` guarantees `locals.user` (guest or
 * real). Returns the identity + a signed `wsToken` the client presents in the WS
 * `hello`. All live state arrives over the socket (Phase 3).
 */
export const load: PageServerLoad = async ({ params, url, locals, platform }) => {
	const user = locals.user;
	if (!user) error(401, 'no session');

	const code = params.code.toUpperCase();
	if (!isValidRoomCode(code)) error(404, 'invalid room code');

	const secret = platform?.env.BETTER_AUTH_SECRET;
	if (!secret) error(500, 'BETTER_AUTH_SECRET not available');

	const wsToken = await mintRoomToken({ userId: user.id, code }, secret);
	// Pool only matters for the creator (first connect builds the board); joiners ignore it.
	const poolId = url.searchParams.get('pool') ?? 'all-stars';
	return { code, me: { id: user.id, name: user.name }, wsToken, poolId };
};
