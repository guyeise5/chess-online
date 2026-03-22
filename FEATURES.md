# Features

## Online Multiplayer

- **Route:** `/lobby` (room list), `/game/:roomId` (game board)
- **Key files:** `client/src/components/Lobby.tsx`, `client/src/components/GameRoom.tsx`, `server/src/game/GameManager.ts`, `server/src/socket/handlers.ts`
- Create and join game rooms from a lobby
- Lichess-style time controls: Bullet (1+0, 2+1), Blitz (3+0, 3+2, 5+0, 5+3), Rapid (10+0, 10+5, 15+10), Classical (30+0, 30+20)
- Color selection (white / black / random)
- Real-time move updates via Socket.IO
- Server-side move validation with chess.js
- Clocks with increment support (server-side timers)
- Undo request system (requires opponent approval)
- Resign option
- Reconnection support (roomId + playerName persisted in localStorage)
- Waiting rooms auto-close if the owner disconnects

## Play vs Computer

- **Route:** `/computer/setup` (configuration), `/computer` (game board)
- **Key files:** `client/src/components/ComputerSetup.tsx`, `client/src/components/ComputerGame.tsx`, `client/src/hooks/useStockfish.ts`
- Stockfish 18 running client-side via WebAssembly (`/stockfish/stockfish-18-lite-single.js`)
- 8 difficulty levels (~800 to ~3000 Elo)
- No time limit
- Instant undo (no opponent approval needed)
- Game state persists across page refreshes via localStorage

## Puzzle Trainer

- **Route:** `/puzzles`, `/puzzles/:puzzleId`
- **Key files:** `client/src/components/PuzzleTrainer.tsx`, `server/src/models/Puzzle.ts`, `server/src/scripts/import-puzzles.ts`
- 4M+ puzzles from the Lichess puzzle database (baked into Docker image)
- Puzzles matched to player rating (±15 Elo range)
- Elo-based rating system with dynamic K-factor
- Hint system (1st hint: highlight piece, 2nd hint: show move arrow)
- Retry flow with "Show Solution" option
- Puzzle rating and tags revealed after solving
- Puzzle ID in URL for sharing/bookmarking

## Game Analysis

- **Route:** `/analysis/:gameId`
- **Key files:** `client/src/components/AnalysisBoard.tsx`, `client/src/components/EvalBar.tsx`, `client/src/components/ScoreGraph.tsx`, `client/src/hooks/useMultiPV.ts`, `client/src/hooks/useStockfishAnalysis.ts`, `server/src/models/Game.ts`
- **Feature flag:** `FEATURE_GAME_STORAGE` (default: enabled)
- Multi-PV engine analysis (5 principal variations, depth 18) via Stockfish WASM worker
- Eval bar showing White advantage with logistic curve and mate distance labels
- Score graph plotting evaluations across the game with scrub/jump navigation
- Move quality labels (best / good / inaccuracy / mistake / blunder)
- Full move navigation (forward, backward, jump to position)
- Game data stored server-side in MongoDB `games` collection with 14-day TTL index
- REST API: `POST /api/games/:gameId` (save), `GET /api/games/:gameId` (load)
- Score flipping for black-to-move positions (always displayed from White's perspective)

## UI/UX

- **Key files:** `client/src/components/PromotionDialog.tsx`, `client/src/components/NamePrompt.tsx`, `client/src/components/Home.tsx`
- Board coordinates and legal move indicators
- Last move highlight
- Check/checkmate king highlight (red glow)
- Lichess-style promotion dialog
- Animated moves via react-chessboard v5
- Responsive design
- Self-hosted Inter font (no external dependencies)
- URL-driven state for all routable views

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_GAME_STORAGE` | `true` | Server-side game storage for analysis (MongoDB `games` collection, 14-day TTL). Set to `false` to disable. |
