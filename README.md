# Double Sir — 4-Player Trick-Taking Card Game

A production-ready, real-time multiplayer web app for a custom partnership
trick-taking card game, featuring a non-standard "consecutive win streak"
hand-collection mechanic and penalty-based scoring.

## Tech Stack

- **Frontend**: Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Zustand, Framer Motion
- **Backend**: Custom Node server (`server.ts`) hosting Next.js + Socket.IO in one process
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Auth.js (Credentials + Google) plus a lightweight signed-cookie Guest Mode

The server is a single long-running Node process (not Vercel serverless) so
Socket.IO can hold persistent WebSocket connections. Deploy it anywhere that
runs a Node process: a VPS, Docker, Railway, Render, Fly.io, etc.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` — your PostgreSQL connection string (local Postgres, Supabase, Neon, RDS, etc.)
- `AUTH_SECRET` / `GUEST_COOKIE_SECRET` — random secrets (`.env.example` ships with generated defaults; regenerate with `npx auth secret` or `openssl rand -base64 32` for a new deployment)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional. Leave blank to disable Google sign-in; Guest Mode and email/password login work fine without it. Create credentials at the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with authorized redirect URI `http://localhost:3000/api/auth/callback/google`.

### 3. Run database migrations

```bash
npx prisma migrate dev
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Open multiple browser
profiles/tabs and use **Play as Guest** to seat 4 players in one room without
needing separate accounts.

## Scripts

| Command              | Description                                      |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Custom server (Next.js + Socket.IO) in watch mode |
| `npm run build`       | Production Next.js build                          |
| `npm start`            | Run the production build (`NODE_ENV=production`)  |
| `npm test`             | Run the Vitest engine test suite                  |
| `npm run test:watch`   | Vitest in watch mode                               |
| `npm run db:migrate`   | Run Prisma migrations                              |
| `npm run db:studio`    | Open Prisma Studio                                 |

## Architecture

```
engine/        Pure game engine — rules, no I/O, no framework imports
  types.ts       Core types: Card, Seat, TeamId, GameAction, ...
  deck.ts        Deck building + seeded shuffle + dealing
  bidding.ts     Bidding state machine
  trick.ts       Follow-suit + trick resolution
  streak.ts      The "Double Sir" consecutive-win trick-capture mechanic
  scoring.ts     Penalty scoring
  match.ts       Hand/match lifecycle, win condition
  reducer.ts     Single entry point: applyAction(state, action) -> {state, events}
  __tests__/     Unit tests covering every worked example in the spec

server/         Realtime + persistence — the only caller of engine/reducer
  session.ts       In-memory GameSession (seats, connections, live MatchState, chat/voice state)
  rooms.ts         Process-local room registry
  persistence.ts   Prisma writes mirroring every state change
  socketHandlers.ts  Orchestrator: auth middleware + hands off to each module below
  gameHandlers.ts    Room lifecycle, bidding/trump/trick play, hand/match progression
  chatHandlers.ts    Text chat send + history replay on (re)join
  voiceHandlers.ts   WebRTC signaling relay (offer/answer/ICE) — never touches audio
  emojiHandlers.ts   Emoji reaction broadcast
  roomHelpers.ts     Shared helpers (seat resolution, state broadcasts, error handling)
  rateLimit.ts       In-process token-bucket rate limiting (chat/emoji/signaling)
  sanitize.ts        Chat input sanitization + emoji whitelist validation

sockets/        Shared client/server wire contracts, organized by event group
  events.ts        Game events + the combined ClientToServerEvents/ServerToClientEvents
  chatEvents.ts    Text chat
  voiceEvents.ts   WebRTC signaling relay
  emojiEvents.ts   Emoji reactions + the whitelisted reaction set
  presenceEvents.ts  Lobby join/left notifications
  redact.ts        Per-viewer hand redaction (hides other players' cards)
  client.ts        Browser Socket.IO client singleton

store/          Zustand client state (mirrors server-authoritative state)
  useGameStore.ts  Game state; also owns the single socket connection lifecycle
  useChatStore.ts  Chat messages + emoji reactions
  useVoiceStore.ts WebRTC mesh manager (peer connections, speaking detection, mic controls)
  useUIStore.ts    Local UI prefs (sound, comms panel open/tab)

components/     UI, organized by feature (game-table, cards, bidding, scoreboard, lobby, match-end, comms)
app/            Next.js App Router pages + API routes
prisma/         Database schema + migrations
```

**Layering rule**: React components never import `engine/` to make gameplay
decisions — they read state mirrored into `store/useGameStore` from Socket.IO
events and dispatch intents back over the socket. All rule enforcement
(bidding, trump selection, trick legality, the streak mechanic, scoring, win
condition) lives once, in `engine/`, invoked only from
`server/socketHandlers.ts`. This is what lets AI players, spectators, or new
game modes be added later without touching engine internals.

## The Custom Rules, In Code

- **Bidding** (`engine/bidding.ts`): a single pass through seats 1→2→3→4.
  Player 1 must bid 7–13 and cannot pass; seats 2–4 may pass or must bid
  strictly higher than the current highest bid.
- **"Double Sir" trick capture** (`engine/streak.ts`): tricks accumulate in
  an unclaimed pool until the *same seat* wins two in a row, at which point
  their team captures the entire pool (not just two). From then on the
  streak is "established" — every further consecutive win by that player is
  captured the instant it's won, one trick at a time, for as long as the
  streak holds. Losing a trick to anyone else fully resets it (per-player,
  never per-team — teammates never share a streak). Trick 13 forces a
  collection even without a fresh streak, guaranteeing
  `teamAHands + teamBHands === 13` after every hand — asserted in code and
  covered by a dedicated invariant test.
- **Scoring** (`engine/scoring.ts`): only the winning bid's declared value
  matters. Bid met → opposing team is penalized the bid amount. Bid missed →
  bidder's team is penalized 2× the bid. Only one team is ever penalized per
  hand.
- **Win condition** (`engine/match.ts`): the first team to reach 53+ penalty
  points loses immediately; the match ends.

Every numbered example from the game spec (bidding examples, all 9 "Double
Sir" trick-capture examples, the trick-13 edge case, and both scoring
examples) is encoded as a named Vitest test case in `engine/__tests__/`.

## Real-Time Communication

Every room (from the lobby through match end) supports voice chat, text
chat, and emoji reactions between exactly its 4 seated players — no
spectators, no cross-room bleed.

- **Voice**: WebRTC full mesh (6 peer connections for 4 players). Socket.IO
  carries signaling only (offer/answer/ICE) — audio flows peer-to-peer once
  connected. STUN-only (`stun:stun.l.google.com:19302`, no TURN server), so
  connection health is tracked **per pair**: if two specific players can't
  connect (symmetric NAT on both ends is the usual cause), the UI shows
  "voice unavailable with X" for just that pair rather than failing the
  whole room. Mic permission is requested the moment a player clicks
  "Enable Voice" (not on page load) — see `store/useVoiceStore.ts`.
- **Text chat**: in-memory per-room history (last 50 messages), replayed to
  a player right after they join or reconnect. Not persisted to Postgres —
  it only needs to survive "while connected," not a server restart.
- **Emoji reactions**: fire-and-forget, whitelisted set, float above the
  sender's seat and auto-expire.
- **Abuse prevention**: every chat/emoji/signaling event is server-validated
  — seat resolved from the authenticated connection (never trusted from the
  client), token-bucket rate limits per socket (`server/rateLimit.ts`), a
  strict emoji whitelist and HTML/control-character stripping on chat text
  (`server/sanitize.ts`).

Event groups (not literal Socket.IO namespaces — one authenticated
connection carries `game:*`, `chat:*`, `voice:*`, `emoji:*`, and presence
events, avoiding 4x the handshakes a real namespace-per-concern split would
cost for a 4-player game) are typed separately under `sockets/` and merged
into the single wire contract in `sockets/events.ts`.

## Verification

- `npm test` — 63 unit/integration tests covering the full rule set (including a full 13-trick hand played end-to-end through the reducer) plus the rate limiter and chat sanitizer.
- `npm run build` — strict TypeScript + Next.js production build.
- The full realtime flow (guest auth → create/join room → bidding → trump selection → 13 tricks → hand completion → penalty scoring → persistence → stats) and the full comms flow (chat send/receive/history-on-reconnect, chat and emoji rate limiting, WebRTC signaling relay for offer/answer/ICE/mute/speaking, disconnect cleanup) were both verified end-to-end against a real Socket.IO + PostgreSQL instance during development. Actual browser-based audio (mic capture, real peer-to-peer audio across two separate networks, mobile Safari quirks) wasn't exercised in this sandboxed environment — worth a manual pass with two real browsers before shipping.
