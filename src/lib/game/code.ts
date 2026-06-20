/** Room codes: short, shareable, unambiguous. Pure so it's reusable + testable. */

// No 0/O/1/I to avoid misreads when sharing verbally.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LEN = 4;

export function generateRoomCode(rand: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < LEN; i++) code += ALPHABET[Math.floor(rand() * ALPHABET.length)];
	return code;
}

const VALID = new RegExp(`^[${ALPHABET}]{${LEN}}$`);

/** Validate an already-uppercased code. */
export const isValidRoomCode = (code: string): boolean => VALID.test(code);
