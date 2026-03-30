# Multiplayer Tic-Tac-Toe

This is a complete, production-ready Multiplayer Tic-Tac-Toe game powered by an Authoritative Server model using Nakama.

## Architecture & Tech Stack

- **Backend**: [Nakama Server](https://heroiclabs.com/nakama/) using **TypeScript** for server-authoritative matchmaking and game loop logic. 
- **Database**: CockroachDB (Managed internally by Nakama Docker node)
- **Frontend**: React (Vite) + Tailwind CSS + Nakama JS Client

## System Architecture

### Pre-Code Design (System Design Before Implementation)

Checkout the **interactive system design diagram** (created before coding):
🔗 [Excalidraw — Pre-Code System Design](https://excalidraw.com/#json=Mijw6YAMFEW_v3D1DYseX,mDuzp55ZICYAzWCLYE6Kig)

This diagram shows:
- Client (React) components and communication layers
- Nakama server modules (Auth, Matchmaker, Match Handler, Leaderboard RPC)
- CockroachDB persistent storage
- Game state machine (WAITING → PLAYING → FINISHED)
- WebSocket OpCodes and key design decisions

---

The game follows a **server-authoritative** architecture with four distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER CLIENT  —  React 19 + Vite + Tailwind v4              │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  App.tsx    │  │GameBoard.tsx │  │   Leaderboard.tsx     │  │
│  │ Auth/Lobby  │  │ 3×3 Grid     │  │  Rankings via RPC     │  │
│  │ Mode Select │  │ Timer Cntdwn │  │  Wins/Losses/Streaks  │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│        nakama-js SDK  (WebSocket + HTTP auth + RPC)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS / WSS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  REVERSE PROXY  —  Caddy                                        │
│  SSL Termination & Domain Routing                               │
│  tictactoe.startup-lab.cloud       → Frontend  :80             │
│  api-tictactoe.startup-lab.cloud   → Nakama   :7350            │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTP :7350 / WS :7349
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  NAKAMA SERVER v3.21.1  —  TypeScript (JS Runtime)  │  Docker  │
│                                                                 │
│  ┌────────────┐ ┌─────────────────┐ ┌──────────────────────┐   │
│  │  main.ts   │ │ matchmaker.ts   │ │  match_handler.ts    │   │
│  │ InitModule │ │matchmakerMatched│ │  Move Validation     │   │
│  │ Create LBs │ │ Mode Detection  │ │  Win/Draw Detection  │   │
│  │ Reg. Hooks │ │ Spawn Auth Match│ │  30s Timer Forfeit   │   │
│  └────────────┘ └─────────────────┘ └──────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ leaderboard_rpc.ts — RPC: get_leaderboard                 │  │
│  │ Merges wins / losses / best streak into a single response │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  CockroachDB driver
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  COCKROACHDB  —  Persistent Storage  │  Docker                  │
│                                                                 │
│  global_wins      (Leaderboard, incr, desc)                     │
│  global_losses    (Leaderboard, incr, desc)                     │
│  global_streaks   (Leaderboard, set,  desc)                     │
│  player_stats     (Storage Collection — current win streak)     │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Breakdown

| Layer | Technology | Responsibility |
|---|---|---|
| **Browser Client** | React 19, Vite, Tailwind v4, nakama-js | UI rendering, user input, real-time state via WebSocket |
| **Reverse Proxy** | Caddy | SSL termination, domain routing to frontend & Nakama API |
| **Game Server** | Nakama v3.21.1, TypeScript | Authoritative match logic, matchmaking, leaderboard RPCs |
| **Database** | CockroachDB | Persistent leaderboards (wins, losses, streaks) and player stats |

### Data Flow

1. **Auth**: Browser authenticates with Nakama via `device_id` (HTTP POST → Nakama → CockroachDB session store)
2. **Matchmaking**: Client adds to matchmaker pool over WebSocket → `matchmaker.ts` intercepts and spawns an authoritative match instance
3. **In-Game**: All moves sent as WebSocket messages (`OP_MOVE`) → `match_handler.ts` validates, updates board, checks win/draw, broadcasts `OP_STATE` to both players
4. **Timers**: In timed mode, `match_handler.ts` checks a server-side `deadline` timestamp every tick (1s); forfeit is applied automatically if expired
5. **Stats**: On match end, `saveMatchStats()` writes to `global_wins`, `global_losses` leaderboards and `player_stats` storage; streaks are tracked server-side
6. **Leaderboard**: `Leaderboard.tsx` calls `get_leaderboard` RPC → `leaderboard_rpc.ts` queries all three leaderboards, merges by `userId`, returns sorted JSON

## Deployment & Setup

This repository is fully containerized using Docker Compose.

1. **Requirements**: Make sure you have Docker and Docker Compose installed.
2. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```
3. **Services**:
   - The **React Frontend** will be available at `http://localhost:3000`.
   - The **Nakama Developer Console** will be available at `http://localhost:7351` (Login: `admin` / `password`).
   - The **Nakama API** is exposed for the client at `http://localhost:7350`.

## Testing the Multiplayer

1. Open `http://localhost:3000` in your browser.
2. Open a *second window* in **Incognito Mode** (this forces a different device_id, creating a separate player account dynamically).
3. Click **Find Match** on the first window. You'll enter the matchmaking pool.
4. Click **Find Match** on the second window.
5. Nakama's matchmaker will successfully pair the two clients and launch a custom Server-Authoritative `Tic-Tac-Toe` game session.
6. The game imposes a strict 30-second move timer which falls back to Nakama Server verification to guarantee absolutely no client-side cheating is possible.

## API & Server Configuration

### Nakama Server Endpoints

| Endpoint | Protocol | Port | Purpose |
|---|---|---|---|
| `/` | HTTP | 7350 | Nakama API (auth, RPC calls) |
| `/` | WebSocket | 7349 | Real-time match communication |
| `/console` | HTTP | 7351 | Nakama Admin Console |
| `localhost:26257` | Internal | 26257 | CockroachDB connection (internal only) |

### Registered RPC Endpoints

```typescript
// Frontend calls this RPC to fetch leaderboard data
client.rpc(session, "get_leaderboard", {})

// Returns:
{
  "players": [
    {
      "userId": "user-id-1",
      "username": "PlayerName",
      "wins": 5,
      "losses": 2,
      "streak": 3
    },
    // ... more players
  ]
}
```

### Game State Machine

The match server maintains a state machine:

```
WAITING (need 2 players)
  ↓ (2nd player joins)
PLAYING (game active, moves accepted)
  ↓ (win/draw/forfeit/timeout)
FINISHED (match terminates)
```

### WebSocket OpCodes

| OpCode | Direction | Payload | Purpose |
|---|---|---|---|
| `OP_MOVE (1)` | Client → Server | `{ "position": 0-8 }` | Player makes a move |
| `OP_STATE (2)` | Server → Clients | `{ "board", "turn", "deadline", "winner", "marks" }` | Broadcast board state |

### Nakama Built-in Collections & Leaderboards

| Name | Type | Operator | Purpose |
|---|---|---|---|
| `global_wins` | Leaderboard | `incr` | Cumulative win count per player |
| `global_losses` | Leaderboard | `incr` | Cumulative loss count per player |
| `global_streaks` | Leaderboard | `set` | Best win streak (max value) |
| `player_stats` | Storage | Custom | Current win streak (resets on loss) |

---

## How to Test Multiplayer Functionality

### Prerequisites
- Docker & Docker Compose running
- Two separate browsers (or incognito windows)

### Step-by-Step Testing

#### 1. **Start the Game Server**
```bash
docker-compose up -d --build
```
Wait for all services to be healthy:
```bash
docker-compose ps
# All services should show "healthy" or "running"
```

#### 2. **Open Two Player Sessions**

**Player 1:**
- Open `http://localhost:3000` in Chrome (or your main browser)
- You'll be auto-assigned a `device_id` (stored in localStorage)
- You should see the Lobby with "Play" and "Leaderboard" tabs

**Player 2:**
- Open `http://localhost:3000` in **Incognito Mode** (or a different browser)
- This forces a different `device_id` → new player account
- You should also see the Lobby

#### 3. **Test Classic Mode (No Timer)**

**Player 1:**
- Click the **♟ Classic** button (if not already selected)
- Click **Find Match**
- You'll see "Searching for Classic opponent..." with a spinner

**Player 2:**
- Click the **♟ Classic** button
- Click **Find Match**

**Expected Result:**
- Both players are matched automatically
- Both see the **Game Board** page with a 3×3 grid
- Player 1 sees "Your Turn" (gets X, goes first)
- Player 2 sees "Opponent's Turn" (gets O)

#### 4. **Play a Game**

**Player 1:**
- Click any empty cell to place X
- Your move is sent as `OP_MOVE` to the server
- Server validates and broadcasts `OP_STATE` to both players

**Player 2:**
- Wait for "Your Turn" message
- Click an empty cell to place O

**Winning:**
- Continue until one player gets 3-in-a-row
- Winner sees "You Won! 🎉" (blue text)
- Loser sees "You Lost! 💔" (red text)
- A "Return to Lobby" button appears

#### 5. **Test Timed Mode (30s Timer)**

**Player 1:**
- Return to Lobby (click button or refresh)
- Click the **⏱ Timed (30s)** button
- Click **Find Match**

**Player 2:**
- Click the **⏱ Timed (30s)** button
- Click **Find Match**

**Expected Result:**
- Both players matched in Timed mode
- Game Board shows countdown: "Your Turn (30s)" → "Your Turn (29s)" → ...
- If a player doesn't move within 30s, server auto-forfeits them
- Non-moving player sees "You Lost! 💔"

#### 6. **Test Leaderboard**

**Any Player:**
- Return to Lobby
- Click **Leaderboard** tab
- You'll see a ranked table of all players (sorted by wins)

**Expected Table:**
```
#  | Player        | W  | L  | 🔥
---|---------------|----|----|----
1  | PlayerName    | 5  | 2  | 3
2  | OtherPlayer   | 3  | 4  | 1
...
```

**Statistics:**
- **W** = Total wins
- **L** = Total losses  
- **🔥** = Best win streak

#### 7. **Test Disconnect Scenario**

**Player 1:**
- Start a game
- Close the browser tab or disconnect
- Server detects disconnect in `matchLeave()` hook

**Player 2:**
- Automatically sees "You Won! 🎉"
- Match is terminated, stats saved

#### 8. **Monitor Server Logs**

```bash
docker-compose logs nakama -f
```

You should see logs like:
```
Tic-Tac-Toe module loaded!
Matchmaker matched users! Creating Tic-Tac-Toe match...
(game loop running with 1 tick/sec)
Failed to write leaderboard/stats: [error] (if any)
```

### Cheat Prevention Test

The server enforces strict validation. Try these (they should **all fail**):

1. **Invalid Position**: Click the same cell twice → only first move accepted
2. **Out of Turn**: Player 2 moves before Player 1 → server rejects
3. **Out of Bounds**: Client can't send position > 8 → server ignores
4. **After Game Ends**: Click cells after win → no effect

---

## Features Delivered

- **Server Authoritative Game Loop**: The server strictly calculates all valid Tic-Tac-Toe Win/Draw logic and emits state diffs.
- **Matchmaking Hook**: Automatically creates private game instances as users enter the matchmaking queues.
- **Auto-Timers**: Automatic forfeiting via a 30s deadline managed by the Server VM execution loop.
- **Global Leaderboards**: Tracks lifetime wins and automatically increments scores when players win.
