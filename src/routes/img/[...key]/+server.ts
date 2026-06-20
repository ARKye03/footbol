import { error } from '@sveltejs/kit';
import { PLACEHOLDER_KEY, contentTypeForKey } from '$lib/server/r2';
import type { RequestHandler } from './$types';

const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Stream a headshot from R2 (docs/02). Falls back to the placeholder; long-caches with ETag. */
export const GET: RequestHandler = async ({ params, platform, request }) => {
	const bucket = platform?.env.ASSETS_BUCKET;
	if (!bucket) error(500, 'R2 binding ASSETS_BUCKET not available');

	let key = params.key;
	let object = await bucket.get(key);
	if (!object && key !== PLACEHOLDER_KEY) {
		key = PLACEHOLDER_KEY;
		object = await bucket.get(key);
	}
	if (!object) error(404, 'asset not found');

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('cache-control', IMMUTABLE);
	if (!headers.has('content-type')) headers.set('content-type', contentTypeForKey(key));

	if (request.headers.get('if-none-match') === object.httpEtag) {
		return new Response(null, { status: 304, headers });
	}
	return new Response(object.body, { headers });
};
