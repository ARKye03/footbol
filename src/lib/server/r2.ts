/** R2 asset-key helpers. Headshots live under `players/<footballerId>.<ext>` (docs/02). */

export const PLACEHOLDER_KEY = 'players/_placeholder.svg';

/** Canonical object key for a footballer headshot. Real sync writes `.webp`; the offline seed writes `.svg`. */
export const playerPhotoKey = (footballerId: string, ext = 'webp') =>
	`players/${footballerId}.${ext}`;

const CONTENT_TYPES: Record<string, string> = {
	webp: 'image/webp',
	svg: 'image/svg+xml',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	avif: 'image/avif'
};

/** Best-effort content type from a key's extension, used when R2 has no stored httpMetadata. */
export function contentTypeForKey(key: string): string {
	const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
	return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}
