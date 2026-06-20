# 00 — Overview

## Vision

A snappy, edge-hosted, two-player guessing game. You and a friend each get a secret footballer drawn from a shared grid. You take turns asking yes/no questions over live chat, flipping down players that don't fit, until you're confident enough to guess your opponent's secret. First correct guess wins; a wrong guess loses.

Design priorities, in order: **near-zero latency**, **zero-friction entry** (no signup to play), **cheap to run** (Cloudflare free/edge tiers), **bilingual EN/ES from day one**.

## Game rules (MVP)

1. **Room**: Player A creates a private room and gets a short code / shareable link. Player B joins with it. Exactly two players per room.
2. **Board**: Both players see the _same_ grid of N footballers (default 24) drawn from a configurable pool (league / era / size). Each footballer card shows a headshot + display name.
3. **Secret assignment**: Each player is privately assigned one footballer from the grid — this is _their_ secret, the one the **opponent** must guess. Assignments are independent (collisions allowed).
4. **Turns**: Players alternate. On your turn you either:
   - **Ask a question** in chat (free text, phrased for yes/no). Your opponent answers **Yes** or **No** (button or chat). Then you flip down non-matching cards and your turn ends; or
   - **Make a guess**: pick a card as your final answer for the opponent's secret. Correct → you win. Wrong → you lose (opponent wins).
5. **Card flipping** is per-player and private — your eliminations are yours. (Synced to your own session so a reconnect restores them.)
6. **End**: First correct guess wins. A wrong guess ends the game immediately in the guesser's loss. Disconnect handling and rematch in [03](./03-realtime-and-game-logic.md).

> **MVP simplification**: the server does **not** evaluate questions. Humans ask and answer in natural language; the server only relays chat, tracks turns, holds the secrets, and adjudicates the final guess. This removes the need for a per-attribute question engine for the MVP. Structured, auto-evaluated questions are a post-MVP mode ([10](./10-roadmap.md)).

## What "MVP" means here

The MVP is the smallest thing that's genuinely fun to play with a friend, end to end, on a deployed URL and locally:

- Create/join a private room via link.
- Shared board from a (pre-seeded) pool.
- Secret assignment, turn-based chat with yes/no answers, manual card flipping.
- Final guess → win/lose → game over screen with rematch.
- Full EN/ES UI.
- Reconnect within a game without losing state.

Explicitly **out** of MVP (see [Roadmap](./10-roadmap.md) Phase 6): real accounts, stats/leaderboards, public matchmaking, structured auto-eval questions, spectators, timers, sound, PWA, live API-Football fetching at runtime (MVP uses a pre-seeded catalog).

## Glossary

| Term                    | Meaning                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| **Room**                | A single game instance, identified by a short code. Backed by one Durable Object.              |
| **Board / grid**        | The shared set of footballer cards shown to both players.                                      |
| **Secret**              | The footballer a player is assigned; the _opponent_ tries to guess it.                         |
| **Pool**                | The filtered catalog (league/era) the board is sampled from.                                   |
| **Catalog**             | All footballers stored in D1, populated by ingestion ([04](./04-data-ingestion.md)).           |
| **Footballer**          | A catalog entry: name, photo, club, league, nationality, position, etc.                        |
| **Guest**               | An anonymous, cookie-backed identity created on first visit ([05](./05-auth-and-sessions.md)). |
| **Durable Object (DO)** | Cloudflare's single-threaded stateful actor; one per room, the authority for live state.       |
| **Hibernation**         | WebSocket Hibernation API — the DO can evict from memory while keeping sockets open.           |

## Constraints & assumptions

- Two players per room. Spectators are post-MVP.
- Footballer data is **pre-seeded** into D1/R2; no API-Football call on the request path (rate limits + egress). Refresh is a background/cron job.
- Everything must run **locally** for development, including the realtime path — see [07](./07-local-development.md).
- Anonymous-first. Real accounts must be addable without reworking game code → guests and users share one Better Auth identity table from the start.
