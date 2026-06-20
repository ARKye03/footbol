/**
 * Configured pools — what's offered in the room "pool picker" (docs/04).
 *
 * `league`/`season` filter the `footballer` catalog in `sampleBoard`. A pool with
 * both `null` draws from the whole catalog (handy for the offline sample set).
 * `apiLeagueId` is only needed by the API-Football sync (docs/04); sample-only
 * pools omit it and are simply skipped by the sync.
 */

export interface Pool {
	id: string; // stable slug used in URLs / the picker
	label: string; // display name
	league: string | null; // matches footballer.league
	season: number | null; // matches footballer.season
	boardSize: number; // cards dealt per game (Guess Who is classically 24)
	apiLeagueId?: number; // API-Football league id, for sync only
}

export const DEFAULT_BOARD_SIZE = 24;

export const POOLS: Pool[] = [
	{ id: 'all-stars', label: 'All-Stars (sample)', league: null, season: null, boardSize: 24 },
	{
		id: 'epl-2023',
		label: 'Premier League 2023/24',
		league: 'Premier League',
		season: 2023,
		boardSize: 24,
		apiLeagueId: 39
	},
	{
		id: 'laliga-2023',
		label: 'La Liga 2023/24',
		league: 'La Liga',
		season: 2023,
		boardSize: 24,
		apiLeagueId: 140
	},
	{
		id: 'seriea-2023',
		label: 'Serie A 2023/24',
		league: 'Serie A',
		season: 2023,
		boardSize: 24,
		apiLeagueId: 135
	},
	{
		id: 'bundesliga-2023',
		label: 'Bundesliga 2023/24',
		league: 'Bundesliga',
		season: 2023,
		boardSize: 24,
		apiLeagueId: 78
	},
	{
		id: 'ligue1-2023',
		label: 'Ligue 1 2023/24',
		league: 'Ligue 1',
		season: 2023,
		boardSize: 24,
		apiLeagueId: 61
	}
];

export const getPool = (id: string): Pool | undefined => POOLS.find((p) => p.id === id);

/** Pools the API-Football sync should refresh (have a real league id). */
export const syncablePools = (): Pool[] =>
	POOLS.filter((p) => p.apiLeagueId != null && p.season != null);
