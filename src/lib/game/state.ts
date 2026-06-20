/**
 * Pure game types — no Cloudflare imports, so the rules module, the Durable
 * Object, and node tests can all share them.
 *
 * Phase 1 adds `BoardCard` (the catalog→board projection). The rest of the live
 * `GameState`, `PlayerSlot`, `ChatEntry`, and `Phase` types land in Phase 2
 * (docs/02, docs/03).
 */

/** Forward-looking structured-question data. MVP ignores it; ingestion fills what it can. */
export interface FootballerAttrs {
	wonBallonDor?: boolean;
	confederation?: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
	preferredFoot?: 'left' | 'right' | 'both';
	[key: string]: unknown;
}

/** A single footballer as shown on the shared board. Sampled from the catalog (docs/04). */
export interface BoardCard {
	footballerId: string;
	name: string;
	photoKey: string;
}
