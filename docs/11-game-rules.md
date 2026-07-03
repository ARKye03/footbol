# 11 — Game Rules (target spec)

The **authoritative** rules for the match flow. This is a _design spec to implement_, not
what the code does today: the shipped MVP uses a simpler model (correct guess → win, wrong
guess → instant loss), implemented in `src/lib/game/rules.ts` and described structurally in
[03](./03-realtime-and-game-logic.md). This doc replaces that win/lose logic. See
[§ Delta from current implementation](#delta-from-current-implementation) for the diff.

## Objective

Two players, one room. Each is privately assigned a **secret** footballer from the shared
board. You win by being the first to correctly **guess your opponent's secret** — subject to
the two constraints below, which exist to make the turn order fair and to punish reckless
guesses.

## Roles

- **Starter (S)** — the player who moves first this game (`order[0]`). Has a structural
  advantage: S always asks and guesses before the opponent each round.
- **Second (T)** — the player who moves second (`order[1]`).
- Roles are fixed for a game; a **rematch swaps them** (the equalizer, below, alternates the
  advantage across games).

## Turn anatomy

A turn belongs to one player P (opponent = O). On P's turn, P takes **exactly one** of:

1. **Ask** — P asks one yes/no question (free chat; MVP isn't auto-evaluated). O answers **Yes**
   or **No**, and **that answer ends P's turn** — O becomes the new turn owner. (P cannot also
   guess this turn; to act on the answer, P guesses at the start of a later turn.)
2. **Guess** — P guesses O's secret directly (no question first). Resolves per the table below.
3. **Pass** — P ends the turn without asking or guessing.

Card flipping (private elimination) is allowed any time and never ends a turn.

> A round = S's full turn, then T's full turn. S always acts first within a round.

> **Note (impl):** Earlier drafts required ask→answer→act _within one turn_ (guess only after
> being answered). The shipped code instead auto-ends the turn on the answer and makes guessing a
> standalone turn action taken before asking — see [Open Q #4](#open-questions-confirm-before-implementing).

## Guess resolution — the two constraints

When P guesses on a normal turn, resolve by **who** P is and **whether** the guess is correct:

| Guesser   | Guess   | Outcome                                                                                    |
| --------- | ------- | ------------------------------------------------------------------------------------------ |
| Starter S | correct | **Equalizer** opens for T (constraint 2). Not a win yet.                                   |
| Starter S | wrong   | S **loses** → **Penalty** opens for O = T (constraint 1).                                  |
| Second T  | correct | T **wins immediately**. No equalizer for S (the asymmetry — S already had the first move). |
| Second T  | wrong   | T **loses** → **Penalty** opens for O = S (constraint 1).                                  |

A wrong guess is **never** an instant opponent-win; it always opens the Penalty phase, which
gives the opponent a chance to win but can also end in a **draw**.

### Constraint 1 — Penalty phase (wrong guess)

> "If you fail the guess, you lose, and the other player has a configurable number of
> questions (default 5). If that player guesses it, they win."

When P guesses **wrong**, P is out (can no longer win). The opponent O enters a one-sided
Penalty phase:

- O may ask up to **`penaltyQuestions`** questions (default **5**). P still answers each
  truthfully (P holds the secret O is hunting).
- O may **guess** at any point in the budget.
  - O **correct** → **O wins** (`penalty_win`).
  - O **wrong** → **draw** (`penalty_draw`) — O failed to capitalize; P already lost, so
    nobody wins.
  - Budget **exhausted** with no correct guess → **draw** (`penalty_draw`).

P cannot guess, ask, or take further turns during the Penalty. P only answers.

### Constraint 2 — Equalizer (starter guesses correct)

> "If the player who starts guesses correctly, the second player gets a chance to also guess,
> because they started second. It does not happen the other way."

Because S acts before T every round, S landing a correct guess does **not** end the game
outright — T is owed one symmetric attempt:

- T gets **exactly one guess** (no new question — T has had equal questions through prior
  rounds).
  - T **correct** → **draw** (`equalizer_draw`) — both found it; S's first-move edge is
    neutralized.
  - T **wrong** or **declines** → **S wins** (`equalizer_held`).

The Penalty phase does **not** trigger for a wrong guess made _inside_ the equalizer — S's
correct guess already stands; T's wrong attempt simply confirms S's win.

This is one-directional: when **T** guesses correctly on a normal turn, T wins immediately and
S gets **no** compensating guess.

## Outcomes

`winnerId` is the winning player's id, or **`null` for a draw**. `endReason`:

| `endReason`      | Meaning                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `guess_win`      | T guessed correctly on a normal turn (outright).                     |
| `equalizer_held` | S guessed correctly; T failed the equalizer. Winner = S.             |
| `equalizer_draw` | S guessed correctly; T also guessed correctly. Draw.                 |
| `penalty_win`    | A wrong guess opened the Penalty; the opponent then guessed right.   |
| `penalty_draw`   | A wrong guess opened the Penalty; the opponent failed within budget. |
| `forfeit`        | A player left/forfeited (see edge cases).                            |
| `abandoned`      | A player disconnected past the grace period.                         |

There is no standalone `wrong_guess` ending anymore — a wrong guess routes through Penalty.

## Configuration (`GameConfig`)

| Field              | Default | Notes                                                        |
| ------------------ | ------- | ------------------------------------------------------------ |
| `boardSize`        | 24      | Existing.                                                    |
| `penaltyQuestions` | 5       | Question budget granted to the survivor after a wrong guess. |

Keep both constraints always-on for the standard mode. (If a "classic / sudden-death" variant
is ever wanted: `penaltyQuestions: 0` ≈ wrong guess → opponent wins immediately, and an
`equalizer: false` flag would disable constraint 2.)

## State machine

```
lobby ─(2nd join)─▶ ready ─(start)─▶ playing ⇄ playing
                                        │  │
            S correct guess  ───────────┘  └─────────── wrong guess (either player)
                  │                                          │
                  ▼                                          ▼
              equalizer ──(T guess)──▶ finished        penalty ──(O guess / budget out)──▶ finished
                                          ▲                                                    │
                                          └──────────── forfeit / abandon ────────────────────┘
```

- **playing** — normal alternating turns (ask → answer → act).
- **equalizer** — only T may act, and only `guess` (once). Resolves to `finished`.
- **penalty** — only the survivor (O) may `ask`/`guess`; the out player (P) may only `answer`.
  Resolves to `finished` on correct guess, wrong guess, or budget exhaustion.
- **finished** — `winnerId` (or `null`) + `endReason` set. `rematch` (swap starter, new board)
  or leave.

## GameState additions (implementation notes)

Augment the existing `GameState` ([02](./02-data-model.md)); these don't yet exist in code:

- `starterId: string` — set to `order[0]` at start; used to branch the guess table. Survives
  rematch as the **new** `order[0]`.
- Turn gating (as shipped): a guess/pass is legal when it's your turn and no ask is outstanding
  (`turn === playerId && !awaitingAnswer`). Answering the outstanding ask rotates `turn` to the
  answerer and increments `turns`. No `answeredThisTurn`/`turnStep` flag is needed.
- `penalty: { asker: string; answerer: string; questionsRemaining: number } | null` — present
  iff `phase === 'penalty'`. `questionsRemaining` starts at `config.penaltyQuestions`,
  decrements per question asked.
- `phase` gains `'penalty'` and `'equalizer'`.
- `winnerId: string | null` already nullable; `endReason` union extended with the values above.

`reduce` changes (`src/lib/game/rules.ts`):

- `guess` is rewritten to the decision table — branch on `cmd.playerId === starterId` and
  correctness, transitioning to `equalizer`, `penalty`, `finished`, as above.
- New legal moves inside `equalizer` (T's single `guess`) and `penalty` (survivor `ask`,
  opponent `answer`, survivor `guess`); everything else returns the usual guard `error`.
- `endTurn` (pass) is only valid in the `act` step of `playing`.
- `gameOver` broadcast must support `winnerId: null` (draw) on the client + `GameOver` UI.

## Worked examples

1. **Outright second-mover win.** S asks; T answers (S's turn ends → T's turn). On T's turn T
   guesses correctly → **T wins** (`guess_win`). No equalizer.

2. **Starter wins, equalizer held.** S guesses correctly on its turn → `equalizer`. T
   guesses, wrong → **S wins** (`equalizer_held`).

3. **Draw by equalizer.** As above but T's equalizer guess is correct → **draw**
   (`equalizer_draw`).

4. **Wrong guess, opponent capitalizes.** S guesses wrong → S out, `penalty` opens for T with
   5 questions. T asks twice (S answers), then guesses correctly → **T wins** (`penalty_win`).

5. **Wrong guess, draw.** T guesses wrong → T out, `penalty` for S (5 questions). S burns all
   5 without a correct guess → **draw** (`penalty_draw`).

## Edge cases

- **Same secret (collisions allowed):** if both guess their own target correctly via the
  equalizer path, it's a normal `equalizer_draw`.
- **Forfeit / leave during playing:** the other player wins (`forfeit`), as today.
- **Forfeit during penalty:** if the **survivor** (the one with the budget) leaves, they
  abandon their last chance → **draw** (`penalty_draw`). If the **out** player leaves, the
  survivor wins (`forfeit`) — they were going to answer anyway.
- **Forfeit during equalizer:** if **T** leaves, S wins (`equalizer_held`). If **S** leaves
  after a correct guess, S's guess stands → **S wins** (`forfeit` not applied).
- **Disconnect / grace:** the existing 60s grace + `opponentLeft/Back` flow wraps all phases;
  exceeding grace resolves via the forfeit rules above with `endReason: 'abandoned'`.
- **Board exhaustion:** not a loss condition; players keep asking/guessing until a guess
  resolves the game.

## Open questions (confirm before implementing)

1. **Penalty: one guess or many?** Spec assumes the survivor's **first wrong guess** ends the
   game in a draw (mirrors "a wrong guess is fatal"). Alternative: allow repeated guesses until
   the question budget is spent. _Chosen default: first wrong guess → draw._
2. **Penalty budget meaning.** Treated as **questions** (ask-answer cycles), with a guess
   allowed at any point and a question not strictly required before guessing. Confirm vs. "must
   spend a question before each guess."
3. **Equalizer: guess-only?** Spec gives T a single guess with **no** question. Alternative:
   let T ask one final question first. _Chosen default: guess-only._
4. **Ask mandatory each turn?** Original spec required ask→answer before guess/pass every turn.
   **Superseded in code:** asking auto-ends the turn on the answer, and a guess is a standalone
   turn action (no prior ask). A player thus asks _or_ guesses _or_ passes per turn — the
   question economy stays symmetric because each turn still yields exactly one action.
5. **Penalty draw vs. survivor-win-by-default.** Spec makes a failed penalty a **draw**.
   Alternative: the wrong-guesser's loss means the opponent wins regardless. _Chosen default:
   draw_ (the nuance the constraint exists to add).

## Delta from current implementation

`rules.ts` / [03](./03-realtime-and-game-logic.md) today:

- correct guess → immediate win; **wrong guess → immediate opponent win**; no draws.
- guess allowed any time on your turn (no mandatory ask gating).
- no `starterId`, no penalty budget, no equalizer.

To reach this spec, add: `starterId` + turn-step gating, the `penalty` and `equalizer` phases,
the rewritten `guess` resolution, draw outcomes (`winnerId: null` + new `endReason`s), and the
matching client `GameOver` / phase handling. Extend the `rules.spec.ts` suite to cover the new
table, both penalty endings, and both equalizer endings.

## Glossary

| Term             | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| **Room**         | One game instance, a short code, backed by one Durable Object.              |
| **Board / grid** | The shared set of footballer cards both players see.                        |
| **Secret**       | The footballer a player is assigned; the _opponent_ guesses it.             |
| **Pool**         | The filtered catalog (league/era) the board is sampled from.                |
| **Starter (S)**  | The first mover (`order[0]`); subject to the equalizer.                     |
| **Second (T)**   | The second mover (`order[1]`).                                              |
| **Penalty**      | Post-wrong-guess phase: survivor gets `penaltyQuestions` to win, else draw. |
| **Equalizer**    | Post-correct-guess-by-S phase: T gets one guess to force a draw.            |
