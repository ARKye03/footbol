/**
 * Short-lived signed room tokens (docs/05). The `/play/[code]` load mints one
 * binding `{ userId, code }`; the client sends it in the WS `hello` and the DO
 * validates it before accepting the player (Phase 3) — so a socket can't claim an
 * arbitrary player id. HMAC-SHA256 over the same secret as Better Auth.
 */
const enc = new TextEncoder();

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let bin = '';
	for (const b of arr) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function sign(payload: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

// Constant-time string compare to avoid signature timing leaks.
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export interface RoomTokenClaims {
	userId: string;
	code: string;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h — long enough to sit in a lobby

export async function mintRoomToken(
	claims: RoomTokenClaims,
	secret: string,
	ttlMs = DEFAULT_TTL_MS
): Promise<string> {
	const exp = Date.now() + ttlMs;
	const payload = `${claims.userId}.${claims.code}.${exp}`;
	const sig = await sign(payload, secret);
	return `${b64url(enc.encode(payload))}.${sig}`;
}

/** Validate a token; returns claims or `null` (bad signature, malformed, or expired). */
export async function verifyRoomToken(
	token: string,
	secret: string
): Promise<RoomTokenClaims | null> {
	const dot = token.lastIndexOf('.');
	if (dot < 0) return null;
	const encodedPayload = token.slice(0, dot);
	const sig = token.slice(dot + 1);

	let payload: string;
	try {
		payload = new TextDecoder().decode(
			Uint8Array.from(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
				c.charCodeAt(0)
			)
		);
	} catch {
		return null;
	}

	if (!safeEqual(sig, await sign(payload, secret))) return null;

	const [userId, code, expStr] = payload.split('.');
	const exp = Number(expStr);
	if (!userId || !code || !Number.isFinite(exp) || Date.now() > exp) return null;
	return { userId, code };
}
