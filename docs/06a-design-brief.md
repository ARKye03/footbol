# footbol — Frontend Design Brief

> Companion to [06-frontend.md](./06-frontend.md). A paste-ready brief for generating UI
> designs. Single-player and login/stats go beyond the current MVP docs ([00](./00-overview.md),
> [10](./10-roadmap.md)) — designed here as future-facing, flagged inline.

## Product

"Quién es quién" (Guess Who?) for football/soccer players. Two players join a private
room, each gets a secret footballer from a shared grid of cards (headshot + name), take
turns asking yes/no questions over live chat, flip down cards that don't match, and guess
the opponent's secret. First correct guess wins; wrong guess loses. Real-time, edge-hosted,
zero-friction (playable as a guest, no signup).

## Design language

- **Modern + playful, never childish.** Confident, sporty, a bit arcade — think a premium
  football-game UI (EA FC / Football Manager energy) crossed with a clean web app.
- **Pitch-inspired palette**: deep stadium green + crisp white as the base, with 1–2 vivid
  accent colors (e.g. electric lime / warm orange) for actions, turns, and wins. Offer a
  light theme and a dark "night match" theme.
- Bold, condensed display type for headings/numbers (scoreboard feel); clean readable sans
  for body and chat. Generous rounded corners, soft shadows, subtle pitch-line / net /
  hex-grid textures used sparingly as background motifs — never noisy.
- Tactile, chunky buttons and cards. Tap targets ≥ 44px. A small, consistent token set
  (spacing, radius, 2–3 brand colors), not ad-hoc styling.

## Accessibility (non-negotiable — design for it, don't bolt on)

- WCAG 2.1 AA contrast minimum on all text and UI.
- **Color is never the only signal**: flipped/eliminated cards also dim AND show an icon;
  whose-turn uses shape/label, not just color.
- Full keyboard play: tab through the board, Enter/Space to flip a card, clear focus rings,
  visible focus order. Dedicated controls for ask / answer / guess.
- Cards are real buttons with accessible names ("Flip down {name}", state via aria-pressed).
- aria-live regions: turn changes (assertive), chat + system messages (polite).
- Every animation respects prefers-reduced-motion → instant, non-animated equivalent that
  still communicates the same info.
- Mobile-first; the whole game must be playable one-handed on a phone.

## Bilingual (EN / ES)

- All UI chrome localized; player/club names are NOT translated.
- Design for text expansion (ES ~15–30% longer) — no fixed-width labels that clip.
- A LangSwitcher (EN/ES) lives in the header/layout.

## Animation system (football flavor + signature reveal)

General: ball-bounce loaders, net-ripple on confirms, grass-sway / floodlight ambience,
confetti + crowd-roar burst on a win. Tasteful, fast, skippable. All gated behind
prefers-reduced-motion.

### ⭐ Signature: EAFC-style player reveal (the "final section")

A staged, suspenseful reveal of a footballer, used in two places: (a) showing a player
their own assigned secret at game start, and (b) the secret reveal on the Game Over screen.
Sequence, each stage building on the last against a spotlit stadium backdrop:

1. **Silhouette** — dark figure of the player fades up under a radial floodlight, shimmer.
2. **Position** — position badge (e.g. ST, GK, CB) snaps/flips in.
3. **Country** — nationality flag + country slides in.
4. **Name** — name wipes/types in with a scoreboard flourish.
5. **Reveal** — silhouette dissolves into the full-color headshot; card border glints,
   particles/confetti pop, optional rating-card frame.

Provide: a "Skip"/tap-to-advance control, a fully reduced-motion variant (show the finished
card instantly), and timing that feels punchy (~2–3s total, skippable).

## Screens to design

### 1. Landing / Home (`/`)

Entry point. Hero with brand + tagline and football motion in the background.

- **Logged-in / returning guest**: a stats strip up top (games played, win/loss, win
  streak, recent results) — for guests show "Play to build your stats" + a nudge to create
  an account to keep them. _[Stats UI is future-facing; design the slot now.]_
- Primary actions, big and obvious:
  - **Single player** — start a game vs CPU. _[New mode, not in MVP docs — design as "vs CPU".]_
  - **Multiplayer** — creates a private room and produces a **shareable link + short code**
    (copy button, native share, optional QR) to send a friend.
  - **Join** — enter a code / paste a link.
- Set display name inline. Link to How to Play. LangSwitcher + theme toggle in header.

### 2. Login / Auth (`/login`)

Email + password, plus "Continue as guest" (the default, zero-friction path). Sign-up,
sign-in, and a path to upgrade an existing guest into a real account without losing history.
Friendly errors, loading states. _[Accounts are post-MVP per docs — design but mark optional.]_

### 3. Lobby (inside `/play/[code]`, pre-game)

After creating/joining, before both players are in.

- "Waiting for opponent…" with an animated state and the shareable link/code/QR again.
- Creator can pick the pool (league / era / board size) and a Start button (enabled when 2
  present). Show who's joined. Connection status.

### 4. Game (`/play/[code]`, playing)

The core. Responsive layout combining:

- **Board** — grid of footballer cards (≈4×6 desktop, 3-wide scroll on mobile). Each card:
  headshot + name, clearly flippable. **Flipped-down = dimmed/greyed + icon, not removed**
  (players can un-flip mistakes). CSS flip animation.
- **TurnBar** — whose turn it is, visually unmistakable (your turn vs their turn look very
  different). Controls contextual to state: Ask / Answer Yes|No / End turn / Guess.
- **Chat** — question / answer / system log; input enabled only when it's your move.
- **Guess flow** — board enters a "select your guess" mode + a confirm dialog that warns it
  is irreversible (a wrong guess loses).
- **ConnectionBadge** — connected / reconnecting / opponent-left with a grace countdown.

Design the distinct moments: _your turn_ vs _their turn_, _waiting for their answer_,
_answering their question_ (their question shown prominently with Yes/No), _select-to-guess_.

### 5. Game Over

Winner + why (correct guess / wrong guess / opponent abandoned). **Reveal both secrets using
the EAFC-style reveal animation.** Win = confetti + crowd roar; loss = a graceful, encouraging
treatment. Actions: Rematch / New game / Home.

### 6. How to Play (`/how-to-play`)

Static, bilingual, visual rules walkthrough. Short, scannable, illustrated.

### 7. Profile / Stats (future)

Per-player W/L, streaks, recent games, win-rate. _[Phase 6 — design a clean placeholder.]_

### 8. System / unhappy-path states

Design these explicitly, on-brand and reassuring (not raw errors):

- Invalid room code, room full, expired room.
- Network drop / reconnecting; opponent left + grace countdown; opponent returned.
- Empty states, loading skeletons, toasts.
- 404 / generic error.

## Cross-cutting

- Header/layout with logo, LangSwitcher, theme toggle, and (when present) account/guest menu.
- Consistent loading + skeleton patterns. Sound is optional and OFF by default with a toggle.
- Deliver a small design-token set (colors light+dark, type scale, spacing, radius, shadows)
  plus the key components: Card (default/flipped/guess-select/disabled), Button variants,
  TurnBar, Chat bubble, dialogs, badges, the reveal card.

## Deliverable

Mobile + desktop layouts for each screen, the documented states above, the token system, and
storyboard frames for the EAFC reveal sequence. Tailwind-friendly (this is a SvelteKit +
Tailwind v4 app).
