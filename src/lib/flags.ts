/**
 * Country name → flag emoji. Catalog `nationality` is an English ISO country name
 * (docs/02); cards show the flag. Unknown names fall back to a neutral globe.
 */
const ALPHA2: Record<string, string> = {
	Argentina: 'AR',
	Australia: 'AU',
	Austria: 'AT',
	Belgium: 'BE',
	Brazil: 'BR',
	Cameroon: 'CM',
	Canada: 'CA',
	Chile: 'CL',
	China: 'CN',
	Colombia: 'CO',
	Croatia: 'HR',
	Czechia: 'CZ',
	Denmark: 'DK',
	Ecuador: 'EC',
	Egypt: 'EG',
	England: 'GB',
	France: 'FR',
	Georgia: 'GE',
	Germany: 'DE',
	Ghana: 'GH',
	Greece: 'GR',
	Guinea: 'GN',
	Hungary: 'HU',
	Iceland: 'IS',
	Iraq: 'IQ',
	Ireland: 'IE',
	Italy: 'IT',
	Ivory: 'CI',
	Japan: 'JP',
	Mexico: 'MX',
	Morocco: 'MA',
	Netherlands: 'NL',
	Nigeria: 'NG',
	Norway: 'NO',
	Poland: 'PL',
	Portugal: 'PT',
	Russia: 'RU',
	Scotland: 'GB',
	Senegal: 'SN',
	Serbia: 'RS',
	Slovenia: 'SI',
	'South Korea': 'KR',
	Spain: 'ES',
	Sweden: 'SE',
	Switzerland: 'CH',
	Türkiye: 'TR',
	Turkey: 'TR',
	Ukraine: 'UA',
	Uruguay: 'UY',
	'United States': 'US',
	Wales: 'GB'
};

/** Two regional-indicator codepoints from an alpha-2 code. */
const toEmoji = (cc: string): string =>
	String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

export function flagEmoji(nationality: string | null | undefined): string {
	if (!nationality) return '🌐';
	const cc = ALPHA2[nationality] ?? ALPHA2[nationality.split(/\s+/)[0]];
	return cc ? toEmoji(cc) : '🌐';
}
