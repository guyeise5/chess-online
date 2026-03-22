# Chess

A real-time chess application with online multiplayer, computer opponent, and puzzle training. Built with Node.js, TypeScript, React, and WebSockets.

## Features

### Play Online
- Create and join game rooms from a lobby
- Lichess-style time controls: Bullet (1+0, 2+1), Blitz (3+0, 3+2, 5+0, 5+3), Rapid (10+0, 10+5, 15+10), Classical (30+0, 30+20)
- Pick your color (white / black / random)
- Real-time move updates via WebSockets
- Server-side move validation
- Clocks with increment support
- Undo request system (requires opponent approval)
- Resign option
- Reconnection support — refresh or disconnect without losing the game
- Waiting rooms auto-close if the owner disconnects

### Play vs Computer
- Stockfish 18 running client-side via WebAssembly
- 8 difficulty levels (~800 to ~3000 Elo)
- No time limit
- Instant undo (no approval needed)
- Game state persists across page refreshes via localStorage

### Puzzle Trainer
- 4M+ puzzles from the Lichess puzzle database
- Puzzles matched to player rating (±15 Elo range)
- Elo-based rating system with dynamic K-factor
- Hint system (1st hint: highlight piece, 2nd hint: show move arrow)
- Retry flow with "Show Solution" option
- Puzzle rating and tags revealed after solving
- Puzzle ID in URL for sharing

### UI/UX
- Board coordinates, legal move indicators, last move highlight
- Check/checkmate king highlight (red glow)
- Lichess-style promotion dialog
- Animated moves
- Responsive design
- Self-hosted Inter font (no external dependencies)

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Server** | Node.js, Express, TypeScript, Socket.IO, chess.js, Mongoose |
| **Client** | React 19, TypeScript, Vite, react-chessboard, Socket.IO client, React Router |
| **Engine** | Stockfish 18 (WASM, client-side) |
| **Database** | MongoDB 8 |
| **Deployment** | Docker, Docker Compose |
| **Testing** | Jest + mongodb-memory-server (server), Vitest + jsdom (client) |

## Quick Start with Docker

```bash
docker compose up --build
```

Open **http://localhost:3001** in your browser.

The `puzzle-init` container will automatically import the Lichess puzzle database into MongoDB on first run (bundled in the image for offline/on-prem environments).

## Local Development

### Prerequisites

- Node.js 20+
- MongoDB running on `localhost:27017`

### Server

```bash
cd server
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

The client dev server runs on `http://localhost:5173` and proxies WebSocket/API connections to the server on port 3001.

### Running Tests

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017/chess-online` | MongoDB connection string |
| `PORT` | `3001` | Server port |

| `AUTHOR_URL` | — | Optional URL for the author watermark link (injected at runtime) |
| `FEATURE_GAME_STORAGE` | `true` | Enable server-side game storage for analysis (MongoDB `games` collection with 14-day TTL) |

## Project Structure

```
chess-online/
├── client/                     # React frontend
│   ├── public/
│   │   ├── fonts/              # Self-hosted Inter font
│   │   ├── stockfish/          # Stockfish WASM (copied on postinstall)
│   │   └── favicon.png
│   └── src/
│       ├── components/
│       │   ├── Home.tsx            # Landing page with navigation
│       │   ├── Lobby.tsx           # Online room management
│       │   ├── ComputerSetup.tsx   # Computer game configuration
│       │   ├── ComputerGame.tsx    # Computer game board
│       │   ├── GameRoom.tsx        # Online game board
│       │   ├── PuzzleTrainer.tsx   # Puzzle training interface
│       │   ├── PromotionDialog.tsx # Piece promotion overlay
│       │   └── NamePrompt.tsx      # Player name entry
│       ├── hooks/
│       │   └── useStockfish.ts     # Stockfish Web Worker hook
│       ├── __tests__/              # Client unit tests
│       ├── App.tsx                 # Root component with routing
│       ├── socket.ts               # Socket.IO client instance
│       └── types.ts                # Shared TypeScript types
├── server/
│   └── src/
│       ├── game/
│       │   └── GameManager.ts      # Core game logic, timers, undo
│       ├── models/
│       │   ├── Room.ts             # Room schema + time format derivation
│       │   └── Puzzle.ts           # Puzzle schema
│       ├── socket/
│       │   └── handlers.ts         # Socket.IO event handlers
│       ├── scripts/
│       │   └── import-puzzles.ts   # Puzzle CSV importer
│       ├── __tests__/              # Server unit tests
│       └── index.ts                # Entry point
├── Dockerfile                      # Multi-stage production build
├── Dockerfile.puzzle-init          # Puzzle import init container
├── docker-compose.yml              # App + MongoDB + puzzle-init
├── puzzle-init.sh                  # Puzzle import entrypoint script
└── .cursor/rules/                  # AI coding conventions
```

## Offline / On-Prem Deployment

This application is designed to run in air-gapped environments. After Docker images are built, no internet access is required:

- All fonts and static assets are bundled locally
- Stockfish WASM is included in the client build
- The Lichess puzzle database is baked into the puzzle-init Docker image
- No external CDN, API, or telemetry calls at runtime
