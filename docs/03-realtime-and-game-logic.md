# 03 — Realtime & Game Logic

The heart of the app. Three layers, deliberately separated:

1. **`src/lib/game/rules.ts`** — pure, dependency-free state machine. No Cloudflare, no I/O. Fully unit-testable in the node vitest project.
2. **`src/lib/server/durable/game-room.ts`** — the `GameRoom` Durable Object. Owns sockets + storage; *delegates all game decisions to `rules.ts`*; broadcasts results.
3. **`src/lib/client/room-socket.svelte.ts`** — client WebSocket store (runes) that sends intents and applies broadcast state.

`src/lib/game/protocol.ts` defines the wire messages, shared verbatim by client and DO.

## Pure rules module (`rules.ts`)

A reducer over `GameState` ([02](./02-data-model.md)). Single entry point keeps the DO dumb:

```ts
export type Command =
  | { t: 'join'; playerId: string; name: string }
  | { t: 'start' }                                   // when 2 players present
  | { t: 'ask'; playerId: string; text: string }
  | { t: 'answer'; playerId: string; value: boolean } // responder answers yes/no
  | { t: 'endTurn'; playerId: string }
  | { t: 'flip'; playerId: string; footballerId: string; down: boolean } // private
  | { t: 'guess'; playerId: string; footballerId: string }
  | { t: 'forfeit'; playerId: string }
  | { t: 'disconnect'; playerId: string }
  | { t: 'reconnect'; playerId: string };

export interface Reduction { state: GameState; broadcast: ServerMessage[]; error?: string; }

export function reduce(state: GameState, cmd: Command, now: number): Reduction;
```

`reduce` is a **total function**: it validates guards, returns the next state plus the messages to broadcast, or leaves state unchanged with an `error`. It never throws on user input. Board creation and secret assignment live in `board.ts` and use `state.seed` so tests are deterministic:

```ts
export function buildBoard(pool: Footballer[], size: number, seed: number): BoardCard[];
export function assignSecrets(board: BoardCard[], order: string[], seed: number): Record<string, string>;
```

### State machine

```
lobby ──(2nd join)──▶ ready ──(start)──▶ playing ⇄ playing  ──(guess)──▶ finished
   │                                        │                              ▲
   │                                        └──(forfeit / abandon)─────────┘
   └──(creator alone)── stays lobby
```

- **lobby**: 0–1 players. A 3rd join is rejected (`error: 'room_full'`).
- **ready**: both joined; either may `start` (or auto-start). `buildBoard` + `assignSecrets` run; `turn = order[0]`; `phase = playing`.
- **playing**: only `turn`'s owner may `ask` or `guess`. After an `ask`, the **other** player may `answer`. `flip` is allowed any time by either player (private). `endTurn` (by current player, after the answer) rotates `turn`.
- **guess**: transient — resolved synchronously inside `reduce` (correct → win, wrong → loss), so it lands in `finished`. Modeled as a phase only if a confirm dialog round-trip is desired.
- **finished**: `winnerId` + `endReason` set. Only `rematch` (new game, swapped order, fresh board) or leave.

### Turn & guess rules (guards in `reduce`)
- `ask`: must be `playing` and `playerId === turn`. Appends a `question` chat entry. Sets an internal `awaitingAnswer` flag.
- `answer`: must be `playing`, `awaitingAnswer`, and `playerId !== turn` (the opponent answers). Appends an `answer` entry; clears the flag.
- `endTurn`: must be `playing`, `playerId === turn`, not `awaitingAnswer`. Rotates `turn`, increments `turns` counter.
- `guess`: must be `playing`, `playerId === turn`. Compare `footballerId` to the **opponent's** `secretId`. Correct → `winnerId = playerId`, `endReason = 'correct_guess'`. Wrong → `winnerId = opponent`, `endReason = 'wrong_guess'`. → `finished`.
- `flip`: toggles membership in the player's own `eliminated[]`. Never affects the opponent.

### Edge cases (all handled in `reduce` / the DO)
- **3rd connection**: rejected before join; socket closed with code/ reason `room_full`.
- **Reconnect**: same `playerId` reattaches; DO replays a full `state` snapshot (including that player's private `eliminated`). `connected = true`.
- **Disconnect mid-game**: DO sets `connected = false`, broadcasts `opponentLeft`, and sets an **alarm** for a grace period (e.g. 60s). If they return → resume. If not → `endReason = 'abandoned'`, remaining player wins.
- **Both ask out of turn / double answer**: guarded → `error`, no state change. The DO's single-threaded execution means no two commands interleave.
- **Room expiry**: alarm deletes DO storage N hours after creation to stay tidy.

## Durable Object (`game-room.ts`)

Uses the **WebSocket Hibernation API** so idle rooms cost ~nothing.

```ts
export class GameRoom {
  private state: GameState | null = null;
  constructor(private ctx: DurableObjectState, private env: Env) {}

  private async load(): Promise<GameState> {
    this.state ??= (await this.ctx.storage.get<GameState>('game')) ?? freshState();
    return this.state;
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected ws', { status: 426 });
    const playerId = new URL(req.url).searchParams.get('pid'); // validated server-side, see below
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [playerId!]);   // tag = playerId for routing/hibernation
    // (join is driven by the first client message, or here if pid is trusted)
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const msg = parseClientMessage(raw);                 // protocol.ts
    const cmd = toCommand(msg, this.tagOf(ws));
    const { state, broadcast, error } = reduce(await this.load(), cmd, Date.now());
    if (error) return ws.send(encode({ t: 'error', message: error }));
    this.state = state;
    await this.ctx.storage.put('game', state);
    if (state.phase === 'finished') await this.persistHistory(state); // write D1 gameRecord
    this.dispatch(broadcast, state);                     // per-socket: shared state + own eliminations
  }

  async webSocketClose(ws: WebSocket) {
    const r = reduce(await this.load(), { t: 'disconnect', playerId: this.tagOf(ws) }, Date.now());
    this.state = r.state; await this.ctx.storage.put('game', r.state);
    await this.ctx.storage.setAlarm(Date.now() + 60_000); // grace period
    this.dispatch(r.broadcast, r.state);
  }

  async alarm() { /* finalize abandonment / expire room */ }
}
```

Key points:
- **`acceptWebSocket` + tags** (the player id) → the DO can hibernate and still identify each socket on wake.
- **Authority**: clients send *intents*; the DO is the only writer. Clients never trust their own optimistic state for anything adjudicated (turns, guesses).
- **Per-socket dispatch**: each player gets the shared `GameState` minus the opponent's secret/eliminations, plus their own private `eliminated`. Never leak `secretId` of the card a player is supposed to guess.
- **History**: on `finished`, write a `gameRecord` row to D1 (via `getDb(env.DB)`) for post-MVP stats. Best-effort; wrap in `ctx.waitUntil`.

## WebSocket protocol (`protocol.ts`)

Discriminated unions, JSON-encoded. Shared by client and DO so types can't drift.

**Client → Server**
```ts
export type ClientMessage =
  | { t: 'hello'; token: string }              // session token to authenticate the socket
  | { t: 'ask'; text: string }
  | { t: 'answer'; value: boolean }
  | { t: 'endTurn' }
  | { t: 'flip'; footballerId: string; down: boolean }
  | { t: 'guess'; footballerId: string }
  | { t: 'rematch' }
  | { t: 'leave' };
```

**Server → Client**
```ts
export type ServerMessage =
  | { t: 'state'; state: PublicGameState; you: string }   // full snapshot (on connect / big change)
  | { t: 'patch'; version: number; chat?: ChatEntry; turn?: string; phase?: Phase } // small deltas
  | { t: 'opponentLeft'; graceMs: number }
  | { t: 'opponentBack' }
  | { t: 'gameOver'; winnerId: string | null; reason: string; secretReveal: Record<string, string> }
  | { t: 'error'; message: string };
```

`PublicGameState` is `GameState` with opponent secrets stripped and only the recipient's `eliminated` included. The `secretReveal` on `gameOver` finally discloses both secrets for the end screen.

### Socket authentication
The WS query carries no trust by itself. On `hello`, the DO validates the session **token** the SvelteKit page minted (a short signed value tied to the guest/user id + room code, issued by `/play/[code]` `load`). This binds the socket to a real identity and prevents impersonating a player id. The DO maps token → `playerId`, then drives `join`. (MVP can start with the page passing a server-validated `pid`; harden to signed tokens before public launch.)

## Rematch
`rematch` from `finished`: keep the same room/players, swap `order` (loser goes first), rebuild board + secrets with a new `seed`, `phase = playing`. Both clients get a fresh `state`.

## Client store (`room-socket.svelte.ts`)
A runes-based class: opens `wss://<host>/ws/<code>?...`, exposes reactive `$state` (`phase`, `board`, `chat`, `turn`, `you`, `eliminated`, `connected`), sends typed `ClientMessage`s, applies `state`/`patch`, auto-reconnects with backoff and re-`hello`s. Components bind to it; see [06](./06-frontend.md).
