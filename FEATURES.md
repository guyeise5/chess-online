# Features

## Online Multiplayer

- **Route:** `/` (lobby, default landing page), `/game/:roomId` (game board)
- **Static shell:** `index.html` is served with `Cache-Control: no-store` (and `Pragma: no-cache`) so a normal refresh loads the latest client entry; hashed JS/CSS assets remain separately cacheable (`server/src/staticIndexHeaders.ts`, `server/src/index.ts`)
- **Key files:** `client/src/components/Lobby.tsx`, `client/src/components/GameRoom.tsx`, `client/src/components/NavBar.tsx`, `client/src/hooks/useOnlinePlayerCount.ts`, `server/src/game/GameManager.ts`, `server/src/socket/handlers.ts`, `server/src/socket/onlinePlayerCount.ts`
- NavBar shows a live count of Socket.IO connections (browser sessions / tabs) beside the board-settings control once the first count arrives; server broadcasts `presence:online-count` on connect/disconnect. Not unique player names. Feature flag: `FEATURE_ONLINE_PLAYER_COUNT`
- Lichess-style lobby as the default landing page with game creation panel and open games table
- 3×4 time-control grid: 1+0, 2+1, 3+0, 3+2, 5+0, 5+3, 10+0, 10+5, 15+10, 30+0, 30+20, Custom — clicking a preset instantly creates a room
- Custom time control popup with range sliders: minutes (0, ¼, ½, 1–180), increment (0–180s); "Create lobby" button
- Color selection (white / black / random) with chess piece SVG icons
- Real-time move updates via Socket.IO
- Server-side move validation with chess.js
- Clocks with increment support (server-side timers)
- Premoves: drag or click to queue a move while waiting for opponent; auto-executed when it becomes your turn; Lichess-style blue highlight
- Material difference display in player bars (piece icons + point advantage, Lichess-style)
- Undo request system (requires opponent approval); Lichess-style inline accept/decline in the control bar
- Resign with Lichess-style two-click confirmation (click flag icon, then confirm ✓ or cancel ✗; auto-cancels after 3s)
- Move history browsing: click any past move in the moves list to view that position; board dims with a semi-transparent overlay, piece interactions are disabled; purple "Back to game" button in the action bar returns to the live position; navigating to the last move also returns to live play
- Reconnection support (roomId + playerName persisted in localStorage)
- Waiting rooms auto-close if the owner disconnects
- Disconnect claim: if a player disconnects or navigates away during a game, the opponent is notified and after a 10-second grace period can claim a win or draw; reconnecting within the grace period cancels the claim
- Navigation lock: players in an active game cannot navigate to other tabs (lobby, computer, puzzles, etc.); nav links are visually disabled and route guard redirects back to the game
- Give time: "+" button next to opponent's clock adds 15 seconds instantly (no confirmation)
- Draw offer: two-click to offer (click ½ icon, confirm ✓ or cancel ✗; auto-cancels after 3s); opponent sees minimal inline accept/decline in the control bar (no banner); making a move implicitly declines; anti-spam prevents re-offering until opponent makes a move (Lichess-style)
- Lichess-style game control bar: compact icon buttons (↶ takeback, ½ draw, ⚑ resign) with dark background; confirm/cancel (✓/✗) pattern for destructive actions
- In-game chat: floating panel pinned to bottom-left, toggleable open/closed; red notification badge when closed and opponent sends a message; shows player messages and system messages (time given, game over with reason)
- Feature flags: `FEATURE_DISCONNECT_CLAIM`, `FEATURE_GIVE_TIME`, `FEATURE_DRAW_OFFER`, `FEATURE_GAME_CHAT`, `FEATURE_ONLINE_PLAYER_COUNT`

## Private Games

- **Route:** `/invite/:roomId` (invite acceptance page)
- **Key files:** `client/src/components/PrivateInvite.tsx`, `client/src/components/Lobby.tsx` (modal), `server/src/game/GameManager.ts`, `server/src/socket/handlers.ts`
- **Feature flag:** `FEATURE_PRIVATE_GAMES`
- Create a private game from the lobby via the "Create Private Game" button
- Same configuration as public games: time control presets/custom, color selection
- Private rooms are hidden from the lobby room list
- Owner receives a shareable invite link (`/invite/<roomId>`)
- Invitee opens the link, sees game configuration (time, mode, color assignment), and accepts to start the game
- If the owner disconnects or cancels before an opponent joins, the room is deleted and the invite link shows "Game not found"
- Once accepted, the game proceeds identically to a public game (same timers, controls, reconnection, etc.)

## Play vs Computer

- **Route:** `/computer/setup` (configuration), `/computer` (game board)
- **Key files:** `client/src/components/ComputerSetup.tsx`, `client/src/components/ComputerGame.tsx`, `client/src/hooks/useStockfish.ts`
- Stockfish 18 running client-side via WebAssembly (`/stockfish/stockfish-18-lite-single.js`)
- 12 difficulty levels (~600 to ~3200 Elo), ratings calibrated from CCRL data and Lichess estimates
- No time limit
- Material difference display in player bars (shared utility with online play)
- Instant undo (no opponent approval needed)
- Move history browsing: same as online play — click a past move to view that position with dimmed board; purple "Back to game" button returns to live play
- Game state persists across page refreshes via localStorage
- Game auto-saved to server for analysis when the game finishes

## Board & Piece Customization

- **Key files:** `client/src/components/BoardSettings.tsx`, `client/src/hooks/useBoardPreferences.tsx`, `client/src/boardThemes.ts`
- 19 board color themes from Lichess (brown, blue, green, wood, maple, etc.)
- 39 piece sets: 38 from Lichess (cburnett, merida, alpha, california, horsey, etc.) plus a "blindfold" mode (invisible pieces; menu icons stay default)
- Settings stored in MongoDB via user preferences (with localStorage cache), persist across sessions and devices
- Applied to all board views: online play, computer play, puzzles, analysis
- Selected piece set also used for color picker icons in lobby and computer setup menus
- Accessible via gear icon in the navigation bar
- Feature flag: `FEATURE_BOARD_SETTINGS`

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
- Material difference display in player bars (shared utility with online and computer play)
- Analyze button after puzzle completion: fetches the puzzle from the server and opens the analysis board at `/analyzePuzzle/:puzzleId`; uses the same Stockfish engine analysis, eval bar, score graph, and move navigation as game analysis
- Feature flag: `FEATURE_PUZZLE_ANALYSIS`

## Game Analysis

- **Route:** `/analysis/:gameId`
- **Key files:** `client/src/components/AnalysisBoard.tsx`, `client/src/components/EvalBar.tsx`, `client/src/components/ScoreGraph.tsx`, `client/src/hooks/useMultiPV.ts`, `client/src/hooks/useStockfishAnalysis.ts`, `server/src/models/Game.ts`
- **Feature flag:** `FEATURE_GAME_STORAGE` (default: enabled)
- Multi-PV engine analysis (5 principal variations, depth 18) via Stockfish WASM worker
- Eval bar showing advantage with signed score (+/−) on the winning side, logistic curve, and mate distance labels
- Score graph plotting evaluations across the game with scrub/jump navigation
- Move quality annotations on every move (book 📖 / forced ▶ / best ★ / good 👍 / inaccuracy `?!` / mistake `?` / blunder `??`) using winning-chances delta with chess.com Expected Points thresholds (best ≤0.04, good 0.04–0.10, inaccuracy 0.10–0.20, mistake 0.20–0.40, blunder >0.40). Forced moves (only one legal move available) get a distinct arrow icon instead of a quality rating.
- Opening book detection: known opening positions (from Lichess chess-openings) are labeled "book" instead of receiving a WC-delta classification; once a move leaves the book, normal scoring resumes
- Analysis board: legal-move dots and capture rings when selecting or dragging a piece (same styling as live play)
- Material difference display in player bars (updates as you navigate moves)
- Full move navigation (forward, backward, jump to position)
- Game data stored server-side in MongoDB `games` collection with 14-day TTL index
- REST API: `POST /api/games/:gameId` (save with server-side move validation), `GET /api/games/:gameId` (load)
- Server-side move validation on save: only the valid prefix of moves is stored, preventing corrupted data
- Truncation warning banner when loaded game data contains invalid moves
- Score flipping for black-to-move positions (always displayed from White's perspective)

## Game History

- **Route:** `/games`
- **Key files:** `client/src/components/GameHistory.tsx`, `server/src/models/Game.ts`, `server/src/index.ts`
- **Feature flag:** `FEATURE_GAME_HISTORY` (default: enabled)
- Lists all games played by the current player (online and vs computer)
- Shows opponent name, move count, result (Won/Lost/Draw), and date
- Click any game to open it in the analysis board
- Games fetched from MongoDB `games` collection via `GET /api/games?player=<name>`
- Up to 100 most recent games, sorted by newest first

## Move Sounds

- **Key files:** `client/src/utils/sounds.ts`, `client/public/sounds/`
- **Feature flag:** `FEATURE_MOVE_SOUND`
- Lichess standard sound set (Move, Capture, GenericNotify, LowTime MP3 files bundled locally)
- Distinct sounds for standard moves, captures, game start, game end, and low time warning (Lichess-style: no separate check sound)
- Low time warning plays once per player per game when their clock drops to 10 seconds (does not repeat after increment)
- Applied to all game modes: online play, vs computer, and puzzle trainer
- Sounds play on every move (player and opponent), game start, and game end
- Graceful degradation: no errors if audio playback fails

## Introduction

- **Key files:** `client/src/components/Introduction.tsx`, `client/src/components/Introduction.module.css`
- **Feature flag:** `FEATURE_INTRODUCTION`
- Multi-step onboarding walkthrough shown to first-time users after entering their name
- 11 steps by default (fewer when optional NavBar features are disabled): welcome, online play, live connection count, connection status, time controls, rooms, private games, computer play, puzzles, game history & analysis, board customization
- Dot navigation to jump between steps, skip button on every step, "Get Started" on the final step
- Completion persisted via user preferences (`introSeen` field); never shown again once dismissed
- Cursor rule (`.cursor/rules/introduction.mdc`) ensures new UI features are added as steps

## User Preferences (Server-Persisted)

- **Key files:** `server/src/models/UserPreferences.ts`, `server/src/index.ts` (API endpoints), `client/src/hooks/useUserPreferences.ts`
- **Feature flag:** `FEATURE_USER_PREFERENCES`
- User preferences (UI locale `en`/`he`, board theme, piece set, lobby color, custom time control indices, computer color, puzzle rating/count, intro seen) stored in MongoDB
- REST API: `GET /api/preferences/:playerName` (load), `PUT /api/preferences/:playerName` (partial update with upsert)
- Client-side `useUserPreferences` hook fetches from server on login, merges server data over local cache (server wins)
- `UserPrefsProvider` context shares preferences across all components
- localStorage used as write-through cache for instant reads; server is source of truth
- Graceful offline fallback: if server is unavailable, preferences are read/written to localStorage only
- Replaces direct localStorage usage in: `useBoardPreferences`, `Lobby`, `ComputerSetup`, `PuzzleTrainer`, `App` (intro seen)

## Connection Status

- **Key files:** `client/src/hooks/useConnectionStatus.ts`, `client/src/components/NavBar.tsx`, `server/src/socket/handlers.ts`
- **Feature flag:** `FEATURE_CONNECTION_STATUS`
- WiFi-like signal icon in the NavBar showing connection strength to the server
- Latency measured via `ping:latency` Socket.IO event every 5 seconds
- 4 signal levels: excellent (<100ms, green), good (<300ms, green), fair (<600ms, yellow), poor (>=600ms, red)
- Disconnected state shows a crossed-out WiFi icon in red
- Latency displayed in milliseconds next to the icon when connected
- Tooltip shows exact latency or "Disconnected" message

## UI/UX

- **Key files:** `client/src/components/PromotionDialog.tsx`, `client/src/components/NamePrompt.tsx`, `client/src/components/Home.tsx`, `client/src/components/Footer.tsx`
- **Internationalization (English / Hebrew):** `client/src/i18n/` (`I18nProvider`, `en.ts`, `he.ts`), `client/src/main.tsx` wraps the app with `I18nProvider`. New users pick language on the name screen (UK / Israel flag buttons). Signed-in users change language from board settings (gear): flag toggle at the top of the modal. Hebrew sets `document.documentElement` to `dir="rtl"` and `lang="he"`; chess boards stay LTR via `dir="ltr"` on board containers. Server field `locale` on user preferences (see User Preferences).
- Global footer (copyright / optional `AUTHOR_URL` link) on all pages via `App.tsx`
- Material difference utility (`client/src/utils/materialDiff.ts`) shared across game modes
- Board coordinates and legal move indicators
- Last move highlight
- Check/checkmate king highlight (red glow)
- Lichess-style promotion dialog
- Animated moves via react-chessboard v5
- Responsive design
- Self-hosted Inter font (no external dependencies)
- URL-driven state for all routable views

## Server Statistics

- **Route:** `/stats/graphs` (not linked from the UI; direct URL access only)
- **Key files:** `client/src/components/StatsGraphs.tsx`, `client/src/components/StatsGraphs.module.css`, `server/src/index.ts` (API endpoint)
- **Feature flag:** `FEATURE_STATS`
- **API:** `GET /api/stats/daily` — aggregates finished rooms from MongoDB `rooms` collection (7-day TTL window)
- No additional data stored; all statistics derived via aggregation pipelines on existing `rooms` documents
- Bypasses the name prompt — accessible without logging in
- Dark-themed dashboard with recharts-based graphs:
  - Games per day (bar chart)
  - Active players per day (line chart) — unique players from finished games
  - Time format distribution (pie chart) — blitz, rapid, bullet, etc.
  - Result distribution (pie chart) — white wins, black wins, draws
  - Average moves per game per day (line chart)
  - Peak playing hours (bar chart) — games grouped by UTC hour
  - Private vs public games (donut chart)
- Summary cards: total games, peak daily players, average moves per game

## CI/CD

- **CI** (`.github/workflows/ci.yaml`): Runs on pull requests — server tests, client tests, builds, Helm lint/unit tests, Docker build, Kind deploy + smoke test
- **CD** (`.github/workflows/cd.yaml`): Runs on push to `main` — builds and pushes `linux/amd64` Docker images to Docker Hub (3 parallel jobs) tagged with 7-char commit SHA and `latest`
- **Images pushed:** `chess-app`, `chess-puzzle-init`, `chess-opening-init`
- **GitHub Release**: After all images are pushed, creates a GitHub release tagged with the 7-char commit SHA. Artifacts: each image (`chess-app`, `chess-puzzle-init`, `chess-opening-init`, `mongo:8`) as `.tar`, `.zip`, and `.7z`; repository source code as `.zip` and `.7z`.
- **Required secrets:** `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_GAME_STORAGE` | `true` | Server-side game storage for analysis (MongoDB `games` collection, 14-day TTL). Set to `false` to disable. |
| `FEATURE_MATERIAL_DIFF` | `true` | Material difference display in player bars (piece icons + point advantage). Set to `false` to hide. |
| `FEATURE_OPENING_BOOK` | `true` | Opening book move detection in game analysis (MongoDB `bookpositions` collection, Lichess chess-openings data). Set to `false` to disable. |
| `FEATURE_GAME_HISTORY` | `true` | Game history page listing the player's past games for analysis. Set to `false` to disable. |
| `FEATURE_BOARD_SETTINGS` | `true` | Board and piece customization page (39 piece sets incl. blindfold, 19 board themes). Set to `false` to hide settings. |
| `FEATURE_DISCONNECT_CLAIM` | `true` | Disconnect claim system: notifies opponent when a player disconnects or navigates away, allows claiming win or draw after 10s grace period. Navigation lock prevents leaving an active game. Set to `false` to disable. |
| `FEATURE_GIVE_TIME` | `true` | Give time button: "+" next to opponent's clock adds 15 seconds. Set to `false` to disable. |
| `FEATURE_DRAW_OFFER` | `true` | Draw offer system: players can offer a draw with anti-spam protection (Lichess-style). Set to `false` to disable. |
| `FEATURE_PRIVATE_GAMES` | `true` | Private game creation with shareable invite links. Rooms are hidden from the lobby. Set to `false` to disable. |
| `FEATURE_MOVE_SOUND` | `true` | Move sounds using Lichess standard sound set (move, capture, game start/end, low time). Set to `false` to disable. |
| `FEATURE_INTRODUCTION` | `true` | First-time user onboarding walkthrough (10 steps by default; 9 when online count is disabled). Set to `false` to disable. |
| `FEATURE_USER_PREFERENCES` | `true` | Server-side user preferences persistence (MongoDB). Set to `false` to use localStorage only. |
| `FEATURE_GAME_CHAT` | `true` | In-game chat between players in PvP games. Shows player messages and system events (time given, game over). Set to `false` to disable. |
| `FEATURE_ONLINE_PLAYER_COUNT` | `true` | NavBar indicator and Socket.IO `presence:online-count` broadcasts (connected client count). Set to `false` to disable. |
| `FEATURE_MOVE_HISTORY_BROWSE` | `true` | Move history browsing in PvP and vs computer games: click past moves to view positions with dimmed board, purple back button. Set to `false` to disable. |
| `FEATURE_STATS` | `true` | Server statistics dashboard at `/stats/graphs` with daily charts (games, players, time formats, results, peak hours). Set to `false` to disable. |
| `FEATURE_PUZZLE_ANALYSIS` | `true` | Analyze button on completed puzzles, fetches puzzle from server and opens the analysis board at `/analyzePuzzle/:puzzleId`. Set to `false` to disable. |
| `FEATURE_CONNECTION_STATUS` | `true` | WiFi-like signal icon in NavBar showing server connection strength and latency. Set to `false` to disable. |
