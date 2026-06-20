# 06 — Frontend

SvelteKit + Svelte 5 runes (forced on) + Tailwind v4. Bilingual via Paraglide. The UI is thin: most game truth comes over the WebSocket from the Durable Object ([03](./03-realtime-and-game-logic.md)); components render reactive state and emit intents.

## Routes

| Route           | Purpose                                                                        | Server work                                                                                                          |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `/`             | Home: set display name, **Create room** (pick pool), or **Join** by code/link. | `+page.server.ts` action creates a room (`POST /api/rooms`) and redirects to `/play/[code]`.                         |
| `/play/[code]`  | The game room: lobby → board + chat → game over.                               | `+page.server.ts` `load` returns `code`, `me`, `wsToken` ([05](./05-auth-and-sessions.md)). All live updates via WS. |
| `/how-to-play`  | Static rules, EN/ES.                                                           | none                                                                                                                 |
| `/img/[...key]` | Stream R2 headshots with caching.                                              | `+server.ts`, `platform.env.ASSETS_BUCKET`                                                                           |
| `/api/rooms`    | `POST` create room → `{ code }`.                                               | generates code, seeds board via `sampleBoard`, stores nothing itself (DO is created lazily on first WS).             |
| `/api/dev/seed` | Dev-only local catalog seed ([04](./04-data-ingestion.md)).                    | guarded `if (!dev) 404`                                                                                              |

Remove the scaffold `demo/*` routes once auth patterns are copied.

## Component tree (`src/lib/components/`)

```
play/[code]/+page.svelte
├─ Lobby.svelte            # waiting for opponent, share link / copy code, start button
├─ GameView.svelte         # main layout once playing
│  ├─ Board.svelte         # responsive grid of cards
│  │  └─ Card.svelte       # headshot + name; click to flip down/up (private); guess-select mode
│  ├─ TurnBar.svelte       # whose turn, "Ask" / "Answer Yes|No" / "End turn" / "Guess" controls
│  ├─ Chat.svelte          # question/answer/system log; input bound to turn state
│  └─ GuessDialog.svelte   # confirm final guess; warns it's irreversible
├─ GameOver.svelte         # winner, secret reveal, rematch / leave
└─ ConnectionBadge.svelte  # connected / reconnecting / opponent left (grace countdown)
LangSwitcher.svelte        # EN/ES, in layout
```

## Client socket store (`src/lib/client/room-socket.svelte.ts`)

A runes class is the single source of client-side game state. Components read its `$state` fields and call its methods.

```ts
export class RoomSocket {
	phase = $state<Phase>('lobby');
	board = $state<BoardCard[]>([]);
	chat = $state<ChatEntry[]>([]);
	turn = $state<string | null>(null);
	you = $state<string>('');
	eliminated = $state<Set<string>>(new Set()); // my private flips
	connected = $state(false);
	opponentLeft = $state<number | null>(null); // grace deadline ms
	result = $state<{
		winnerId: string | null;
		reason: string;
		reveal: Record<string, string>;
	} | null>(null);

	get myTurn() {
		return this.turn === this.you;
	}

	constructor(code: string, wsToken: string) {
		/* open ws, hello, reconnect w/ backoff */
	}
	ask(text: string) {
		/* send {t:'ask'} */
	}
	answer(v: boolean) {
		/* ... */
	}
	endTurn() {
		/* ... */
	}
	flip(id: string, down: boolean) {
		/* optimistic local toggle + send */
	}
	guess(id: string) {
		/* ... */
	}
	rematch() {
		/* ... */
	}
}
```

- **Optimistic only for private flips** (instant UX, no adjudication risk). Everything adjudicated (turn, answer, guess, game over) waits for the DO broadcast.
- **Reconnect**: on socket close, exponential backoff, reopen, re-send `hello`; DO replies with a full `state` snapshot that restores board + my eliminations. Show `ConnectionBadge` states.
- Open the socket in `onMount`/`$effect` (browser only); close on destroy.

## UX states to design (don't skip the unhappy paths)

- **Lobby**: shareable link + copy button + QR (nice-to-have); "waiting for opponent…"; creator can pick pool (league/era/board size).
- **Your turn vs their turn**: clearly different. Disable ask/guess when not your turn. Surface "opponent is asking…", "answer their question".
- **Answering**: when the opponent asked, show their question prominently with Yes/No buttons.
- **Guessing**: select mode on the board + confirm dialog (irreversible, can lose).
- **Reconnecting / opponent left**: badge + grace countdown; auto-resume or declare winner.
- **Game over**: reveal both secrets, who won and why, rematch / new game / home.
- **Empty/error**: invalid room code, room full, expired room.

## i18n integration

All user-facing strings come from Paraglide. Import message fns from `$lib/paraglide/messages`; add keys to `messages/en.json` + `messages/es.json` (see [08-conventions in 06]). Locale switching uses `localizeHref` (already wired in `+layout.svelte`). Build the `LangSwitcher` to swap locale and persist preference. Football proper nouns (player/club names) come from the catalog and are **not** translated; only UI chrome is. See message-key conventions below.

### Message-key conventions

- Namespaced, dot-free, snake/camel per Paraglide rules: `home_create_room`, `play_your_turn`, `play_answer_yes`, `gameover_you_won`, `error_room_full`.
- Keep EN and ES files key-for-key identical; a CI check (or `pnpm check`) flags missing keys.
- Parameterized messages for dynamic bits (opponent name, countdown).

## Styling / design

- Tailwind v4 (`@tailwindcss/vite` already configured). Keep a small token set (spacing, radius, a 2–3 color brand palette evoking the pitch — green/white) rather than ad-hoc classes everywhere.
- **Board grid**: responsive (e.g. 4×6 on desktop, 3×8 / scroll on mobile). Cards have a clear flipped-down state (dimmed/greyed, not removed) so players can un-flip mistakes.
- **Card flip**: CSS transform animation; respect `prefers-reduced-motion`.
- Mobile-first; the game must be playable one-handed on a phone.

## Accessibility

- Cards are real `<button>`s with accessible names ("Flip down {name}"); flipped state via `aria-pressed`.
- Turn changes announced via an `aria-live` region; chat updates likewise (polite).
- Full keyboard play: tab through board, Enter to flip, dedicated controls for ask/answer/guess.
- Color is never the only signal (flipped state also has an icon/opacity); contrast ≥ WCAG AA.
- Tap targets ≥ 44px.

> Per project rules, validate every Svelte component with the **svelte-autofixer** MCP tool before finalizing, and consult **list-sections** / **get-documentation** for Svelte 5 + SvelteKit APIs (runes, `$effect`, WebSocket in load/onMount, etc.).
