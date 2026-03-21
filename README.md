# Chess Online

A real-time multiplayer chess application built with Node.js, TypeScript, React, and WebSockets.

## Tech Stack

- **Server:** Node.js, Express, TypeScript, Socket.IO, chess.js, Mongoose
- **Client:** React, TypeScript, react-chessboard, Socket.IO client, Vite
- **Database:** MongoDB
- **Deployment:** Docker, Docker Compose

## Features

- Create and join game rooms from a lobby
- Choose time format: Bullet (1 min), Blitz (5 min), Rapid (10 min), Classical (30 min)
- Pick your color (white / black / random)
- Real-time move updates via WebSockets
- Server-side move validation with chess.js
- Clocks with increment support
- Resign option
- Game state persisted in MongoDB

## Quick Start with Docker

```bash
docker compose up --build
```

Open **http://localhost:3001** in your browser.

## Local Development

### Prerequisites

- Node.js 20+
- MongoDB running on `localhost:27017`

### Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

The client dev server runs on `http://localhost:5173` and proxies WebSocket connections to the server on port 3001.

## Project Structure

```
chess-online/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # React components (Lobby, GameRoom, NamePrompt)
│   │   ├── App.tsx       # Root component with routing logic
│   │   ├── socket.ts     # Socket.IO client instance
│   │   └── types.ts      # Shared TypeScript types
│   └── vite.config.ts
├── server/               # Express backend
│   └── src/
│       ├── game/         # GameManager (chess logic, timers)
│       ├── models/       # Mongoose schemas
│       ├── socket/       # Socket.IO event handlers
│       └── index.ts      # Entry point
├── Dockerfile            # Multi-stage build
├── docker-compose.yml    # App + MongoDB
└── README.md
```
