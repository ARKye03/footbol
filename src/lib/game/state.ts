/**
 * Pure game types — no Cloudflare imports, so the rules module, the Durable
 * Object, and node tests can all share them.
 *
 * Phase 0 seeds only `FootballerAttrs` (referenced by the D1 schema). The live
 * `GameState`, `PlayerSlot`, `BoardCard`, `ChatEntry`, and `Phase` types land in
 * Phase 2 (docs/02, docs/03).
 */

/** Forward-looking structured-question data. MVP ignores it; ingestion fills what it can. */
export interface FootballerAttrs {
	wonBallonDor?: boolean;
	confederation?: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
	preferredFoot?: 'left' | 'right' | 'both';
	[key: string]: unknown;
}
