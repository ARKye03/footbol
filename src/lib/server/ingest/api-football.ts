/**
 * API-Football client (docs/04). Off the request path — used only by the catalog
 * sync (cron in prod, `pnpm sync:local` for local). Auth via `x-apisports-key`.
 */
const BASE = 'https://v3.football.api-sports.io';

export interface RawPlayer {
	id: number;
	name: string;
	fullName?: string;
	nationality?: string;
	position?: string; // normalized to GK | DEF | MID | FWD
	club?: string;
	birthYear?: number;
	photo?: string;
}

interface ApiResponse {
	response: ApiEntry[];
	paging: { current: number; total: number };
}

interface ApiEntry {
	player: {
		id: number;
		name: string;
		firstname?: string;
		lastname?: string;
		nationality?: string;
		photo?: string;
		birth?: { date?: string };
	};
	statistics?: { team?: { name?: string }; games?: { position?: string } }[];
}

const POSITION: Record<string, string> = {
	Goalkeeper: 'GK',
	Defender: 'DEF',
	Midfielder: 'MID',
	Attacker: 'FWD'
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalize(entry: ApiEntry): RawPlayer {
	const { player } = entry;
	const stat = entry.statistics?.[0];
	const birthYear = player.birth?.date
		? Number(player.birth.date.slice(0, 4)) || undefined
		: undefined;
	const fullName = [player.firstname, player.lastname].filter(Boolean).join(' ') || undefined;
	return {
		id: player.id,
		name: player.name,
		fullName,
		nationality: player.nationality,
		position: stat?.games?.position
			? (POSITION[stat.games.position] ?? stat.games.position)
			: undefined,
		club: stat?.team?.name,
		birthYear,
		photo: player.photo
	};
}

/**
 * Fetch players for one (league, season), paginating sequentially with a delay to
 * respect rate limits. `maxPages` caps the crawl (free tier is small).
 */
export async function fetchPlayers(
	key: string,
	league: number,
	season: number,
	{ maxPages = 3, delayMs = 1500 }: { maxPages?: number; delayMs?: number } = {}
): Promise<RawPlayer[]> {
	const players: RawPlayer[] = [];
	let page = 1;
	let total = 1;

	while (page <= total && page <= maxPages) {
		const url = `${BASE}/players?league=${league}&season=${season}&page=${page}`;
		const res = await fetch(url, { headers: { 'x-apisports-key': key } });
		if (!res.ok)
			throw new Error(
				`API-Football ${res.status} for league=${league} season=${season} page=${page}`
			);

		const data = (await res.json()) as ApiResponse;
		for (const entry of data.response) players.push(normalize(entry));

		total = data.paging?.total ?? 1;
		page++;
		if (page <= total && page <= maxPages) await sleep(delayMs);
	}

	return players;
}
