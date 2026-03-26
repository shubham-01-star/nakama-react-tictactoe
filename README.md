# Lila Multiplayer Tic-Tac-Toe

This is a complete, production-ready Multiplayer Tic-Tac-Toe game powered by an Authoritative Server model using Nakama.

## Architecture & Tech Stack

- **Backend**: [Nakama Server](https://heroiclabs.com/nakama/) using **TypeScript** for server-authoritative matchmaking and game loop logic. 
- **Database**: CockroachDB (Managed internally by Nakama Docker node)
- **Frontend**: React (Vite) + Tailwind CSS + Nakama JS Client

## Deployment & Setup

This repository is fully containerized using Docker Compose.

1. **Requirements**: Make sure you have Docker and Docker Compose installed.
2. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```
3. **Services**:
   - The **React Frontend** will be available at `http://localhost`.
   - The **Nakama Developer Console** will be available at `http://localhost:7351` (Login: `admin` / `password`).
   - The **Nakama API** is exposed for the client at `http://localhost:7350`.

## Testing the Multiplayer

1. Open `http://localhost` in your browser.
2. Open a *second window* in **Incognito Mode** (this forces a different device_id, creating a separate player account dynamically).
3. Click **Find Match** on the first window. You'll enter the matchmaking pool.
4. Click **Find Match** on the second window.
5. Nakama's matchmaker will successfully pair the two clients and launch a custom Server-Authoritative `Tic-Tac-Toe` game session.
6. The game imposes a strict 30-second move timer which falls back to Nakama Server verification to guarantee absolutely no client-side cheating is possible.

## Features Delivered
- **Server Authoritative Game Loop**: The server strictly calculates all valid Tic-Tac-Toe Win/Draw logic and emits state diffs.
- **Matchmaking Hook**: Automatically creates private game instances as users enter the matchmaking queues.
- **Auto-Timers**: Automatic forfeiting via a 30s deadline managed by the Server VM execution loop.
- **Global Leaderboards**: Tracks lifetime wins and automatically increments scores when players win.
