import { describe, it, expect } from "vitest";
import { Chess, Square } from "chess.js";

interface StockfishLevel {
  level: number;
  skillLevel: number;
  depth: number;
  label: string;
  rating: string;
}

const STOCKFISH_LEVELS: StockfishLevel[] = [
  { level: 1,  skillLevel: 0,  depth: 1,  label: "Level 1",  rating: "~400" },
  { level: 2,  skillLevel: 1,  depth: 2,  label: "Level 2",  rating: "~600" },
  { level: 3,  skillLevel: 2,  depth: 3,  label: "Level 3",  rating: "~800" },
  { level: 4,  skillLevel: 4,  depth: 4,  label: "Level 4",  rating: "~1000" },
  { level: 5,  skillLevel: 6,  depth: 5,  label: "Level 5",  rating: "~1200" },
  { level: 6,  skillLevel: 8,  depth: 7,  label: "Level 6",  rating: "~1400" },
  { level: 7,  skillLevel: 10, depth: 9,  label: "Level 7",  rating: "~1600" },
  { level: 8,  skillLevel: 12, depth: 11, label: "Level 8",  rating: "~1800" },
  { level: 9,  skillLevel: 14, depth: 13, label: "Level 9",  rating: "~2000" },
  { level: 10, skillLevel: 17, depth: 16, label: "Level 10", rating: "~2400" },
  { level: 11, skillLevel: 19, depth: 22, label: "Level 11", rating: "~2800" },
  { level: 12, skillLevel: 20, depth: 30, label: "Level 12", rating: "~3200" },
];

function getLevelConfig(level: number): StockfishLevel {
  return STOCKFISH_LEVELS[Math.max(0, Math.min(level - 1, 11))];
}

describe("Stockfish level mapping", () => {
  it("has 12 levels", () => {
    expect(STOCKFISH_LEVELS).toHaveLength(12);
  });

  it("level 1 is the weakest (skill 0, depth 1)", () => {
    const cfg = getLevelConfig(1);
    expect(cfg.skillLevel).toBe(0);
    expect(cfg.depth).toBe(1);
  });

  it("level 12 is full strength (skill 20, depth 30)", () => {
    const cfg = getLevelConfig(12);
    expect(cfg.skillLevel).toBe(20);
    expect(cfg.depth).toBe(30);
  });

  it("skill level increases monotonically (capped at 20)", () => {
    for (let i = 1; i < STOCKFISH_LEVELS.length; i++) {
      expect(STOCKFISH_LEVELS[i].skillLevel).toBeGreaterThanOrEqual(
        STOCKFISH_LEVELS[i - 1].skillLevel
      );
    }
  });

  it("depth increases monotonically", () => {
    for (let i = 1; i < STOCKFISH_LEVELS.length; i++) {
      expect(STOCKFISH_LEVELS[i].depth).toBeGreaterThan(
        STOCKFISH_LEVELS[i - 1].depth
      );
    }
  });

  it("clamps out-of-range levels", () => {
    expect(getLevelConfig(0)).toEqual(STOCKFISH_LEVELS[0]);
    expect(getLevelConfig(-5)).toEqual(STOCKFISH_LEVELS[0]);
    expect(getLevelConfig(99)).toEqual(STOCKFISH_LEVELS[11]);
  });

  it("each level has a label and rating", () => {
    for (const l of STOCKFISH_LEVELS) {
      expect(l.label).toContain("Level");
      expect(l.rating).toMatch(/^~\d+$/);
    }
  });
});

describe("UCI move parsing", () => {
  it("parses a standard UCI move", () => {
    const uci = "e2e4";
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    expect(from).toBe("e2");
    expect(to).toBe("e4");
    expect(promo).toBeUndefined();
  });

  it("parses a UCI promotion move", () => {
    const uci = "a7a8q";
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    expect(from).toBe("a7");
    expect(to).toBe("a8");
    expect(promo).toBe("q");
  });

  it("applies a UCI move to a chess.js game", () => {
    const game = new Chess();
    const uci = "e2e4";
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const move = game.move({ from, to });
    expect(move).not.toBeNull();
    expect(game.turn()).toBe("b");
  });
});

describe("computer game state transitions", () => {
  it("detects checkmate and determines winner", () => {
    const game = new Chess(
      "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"
    );
    expect(game.isCheckmate()).toBe(true);
    const winner = game.turn() === "w" ? "0-1" : "1-0";
    expect(winner).toBe("0-1");
  });

  it("detects stalemate as draw", () => {
    const game = new Chess("8/8/8/8/8/1Q6/8/k1K5 b - - 0 1");
    expect(game.isStalemate()).toBe(true);
  });

  it("resignation sets correct result for white player", () => {
    const isPlayerWhite = true;
    const result = isPlayerWhite ? "0-1" : "1-0";
    expect(result).toBe("0-1");
  });

  it("resignation sets correct result for black player", () => {
    const isPlayerWhite = false;
    const result = isPlayerWhite ? "0-1" : "1-0";
    expect(result).toBe("1-0");
  });
});

describe("computer game undo", () => {
  function undoToPlayer(game: Chess, playerColor: "w" | "b") {
    let undone = 0;
    do {
      if (game.history().length === 0) break;
      game.undo();
      undone++;
    } while (undone < 2 && game.turn() !== playerColor);
    return undone;
  }

  it("undoes two half-moves (player + computer)", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    game.move("Nf3");
    game.move("Nc6");

    const undone = undoToPlayer(game, "w");
    expect(undone).toBe(2);
    expect(game.history()).toEqual(["e4", "e5"]);
    expect(game.turn()).toBe("w");
  });

  it("undoes one half-move when it is computer's turn", () => {
    const game = new Chess();
    game.move("e4");

    const undone = undoToPlayer(game, "w");
    expect(undone).toBe(1);
    expect(game.history()).toEqual([]);
    expect(game.turn()).toBe("w");
  });

  it("undoes one move when it is computer's turn (black player)", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    game.move("Nf3");
    game.move("Nc6");

    // It's white's (computer's) turn; undo Nc6 → back to black's turn
    const undone = undoToPlayer(game, "b");
    expect(undone).toBe(1);
    expect(game.history()).toEqual(["e4", "e5", "Nf3"]);
    expect(game.turn()).toBe("b");
  });

  it("undoes two moves when computer already replied (black player)", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    game.move("Nf3");
    game.move("Nc6");
    game.move("Bc4");

    // It's black's (player's) turn; undo Bc4 then Nc6 → back to black's turn
    const undone = undoToPlayer(game, "b");
    expect(undone).toBe(2);
    expect(game.history()).toEqual(["e4", "e5", "Nf3"]);
    expect(game.turn()).toBe("b");
  });

  it("undoes single move as black after computer's first move", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");

    const undone = undoToPlayer(game, "b");
    expect(undone).toBe(1);
    expect(game.history()).toEqual(["e4"]);
    expect(game.turn()).toBe("b");
  });

  it("preserves last move highlight after undo", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    game.move("Nf3");
    game.move("Nc6");

    undoToPlayer(game, "w");

    const history = game.history({ verbose: true });
    const lastMove = history.length > 0
      ? { from: history[history.length - 1].from, to: history[history.length - 1].to }
      : null;
    expect(lastMove).toEqual({ from: "e7", to: "e5" });
  });

  it("returns null last move when undone to start", () => {
    const game = new Chess();
    game.move("e4");

    undoToPlayer(game, "w");

    const history = game.history({ verbose: true });
    const lastMove = history.length > 0
      ? { from: history[history.length - 1].from, to: history[history.length - 1].to }
      : null;
    expect(lastMove).toBeNull();
  });
});

describe("computer game undo race condition guard", () => {
  it("generation counter increments on undo, blocking stale callbacks", () => {
    let moveGen = 0;
    const capturedGen = moveGen;

    moveGen++;

    expect(capturedGen).not.toBe(moveGen);
  });

  it("stale callback with old generation is rejected", () => {
    let moveGen = 0;
    let applied = false;

    const gen = moveGen;
    moveGen++;

    if (gen === moveGen) {
      applied = true;
    }
    expect(applied).toBe(false);
  });

  it("current-generation callback is accepted", () => {
    let moveGen = 0;
    let applied = false;

    const gen = moveGen;

    if (gen === moveGen) {
      applied = true;
    }
    expect(applied).toBe(true);
  });

  it("moves list stays correct after undo and continued play", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    game.move("Nf3");
    game.move("Nc6");

    let moves = ["e4", "e5", "Nf3", "Nc6"];

    const g = new Chess();
    for (const san of moves) g.move(san);
    let undone = 0;
    do {
      if (g.history().length === 0) break;
      g.undo();
      undone++;
    } while (undone < 2 && g.turn() !== "w");
    moves = moves.slice(0, -undone);

    expect(moves).toEqual(["e4", "e5"]);

    const afterUndo = new Chess(g.fen());
    afterUndo.move("d4");
    moves = [...moves, "d4"];

    afterUndo.move("d5");
    moves = [...moves, "d5"];

    expect(moves).toEqual(["e4", "e5", "d4", "d5"]);

    const replay = new Chess();
    for (const san of moves) {
      const result = replay.move(san);
      expect(result).not.toBeNull();
    }
    expect(replay.fen()).toBe(afterUndo.fen());
  });

  it("analysis receives complete move list after undo and new play", () => {
    const game = new Chess();
    game.move("e4");
    game.move("e5");
    game.move("Nf3");
    game.move("Nc6");

    let moves = ["e4", "e5", "Nf3", "Nc6"];

    const g = new Chess();
    for (const san of moves) g.move(san);
    g.undo();
    g.undo();
    moves = moves.slice(0, -2);

    g.move("d4");
    moves.push("d4");
    g.move("d5");
    moves.push("d5");
    g.move("exd5");
    moves.push("exd5");

    const analysisData = { moves };
    expect(analysisData.moves).toEqual(["e4", "e5", "d4", "d5", "exd5"]);
    expect(analysisData.moves.length).toBe(5);

    const verify = new Chess();
    for (const san of analysisData.moves) {
      expect(verify.move(san)).not.toBeNull();
    }
  });
});

describe("stale bestmove guard (ignoreNextBestmove)", () => {
  it("stop during active search sets ignore flag", () => {
    let pendingResolve: (() => void) | null = () => {};
    let ignoreNextBestmove = false;

    // Simulate stop() while a search is pending
    if (pendingResolve) {
      ignoreNextBestmove = true;
    }
    pendingResolve = null;

    expect(ignoreNextBestmove).toBe(true);
  });

  it("stale bestmove after stop is ignored", () => {
    let ignoreNextBestmove = true;
    let resolved = false;

    // Simulate bestmove arriving after stop
    if (ignoreNextBestmove) {
      ignoreNextBestmove = false;
      // bestmove ignored
    } else {
      resolved = true;
    }

    expect(resolved).toBe(false);
    expect(ignoreNextBestmove).toBe(false);
  });

  it("next real bestmove is accepted after stale one was consumed", () => {
    let ignoreNextBestmove = false;
    let resolved = false;

    // Simulate real bestmove
    if (ignoreNextBestmove) {
      ignoreNextBestmove = false;
    } else {
      resolved = true;
    }

    expect(resolved).toBe(true);
  });

  it("stop when idle does not set ignore flag", () => {
    let pendingResolve: (() => void) | null = null;
    let ignoreNextBestmove = false;

    if (pendingResolve) {
      ignoreNextBestmove = true;
    }
    pendingResolve = null;

    expect(ignoreNextBestmove).toBe(false);
  });
});

describe("undo to computer turn (black player edge case)", () => {
  it("undo with 1 move as black results in computer turn at start", () => {
    const playerColor = "b";
    const moves = ["e4"];
    const g = new Chess();
    for (const san of moves) g.move(san);

    let undone = 0;
    do {
      if (g.history().length === 0) break;
      g.undo();
      undone++;
    } while (undone < 2 && g.turn() !== playerColor);

    expect(undone).toBe(1);
    expect(g.turn()).toBe("w");
    expect(g.turn()).not.toBe(playerColor);

    const needsComputerMove = g.turn() !== playerColor;
    expect(needsComputerMove).toBe(true);
  });

  it("undo with 2+ moves as black results in player turn", () => {
    const playerColor = "b";
    const moves = ["e4", "e5", "Nf3"];
    const g = new Chess();
    for (const san of moves) g.move(san);

    let undone = 0;
    do {
      if (g.history().length === 0) break;
      g.undo();
      undone++;
    } while (undone < 2 && g.turn() !== playerColor);

    expect(undone).toBe(2);
    expect(g.turn()).toBe("b");
    expect(g.turn()).toBe(playerColor);

    const needsComputerMove = g.turn() !== playerColor;
    expect(needsComputerMove).toBe(false);
  });

  it("undo as white always results in player turn", () => {
    const playerColor = "w";
    const moves = ["e4"];
    const g = new Chess();
    for (const san of moves) g.move(san);

    let undone = 0;
    do {
      if (g.history().length === 0) break;
      g.undo();
      undone++;
    } while (undone < 2 && g.turn() !== playerColor);

    expect(g.turn()).toBe("w");
    expect(g.turn()).toBe(playerColor);
  });
});

describe("undo move replay safety", () => {
  it("replay of valid moves succeeds", () => {
    const moves = ["e4", "e5", "Nf3"];
    const g = new Chess();
    let ok = true;
    try {
      for (const san of moves) g.move(san);
    } catch {
      ok = false;
    }
    expect(ok).toBe(true);
  });

  it("replay of corrupted moves fails gracefully", () => {
    const moves = ["e4", "INVALID"];
    const g = new Chess();
    let ok = true;
    try {
      for (const san of moves) g.move(san);
    } catch {
      ok = false;
    }
    expect(ok).toBe(false);
  });
});

describe("computer game orientation and turns", () => {
  it("player white plays on white's turn", () => {
    const playerColor = "w";
    const game = new Chess();
    expect(game.turn()).toBe(playerColor);
  });

  it("player black waits for computer's first move", () => {
    const playerColor = "b";
    const game = new Chess();
    const isPlayerTurn = game.turn() === playerColor;
    expect(isPlayerTurn).toBe(false);
  });

  it("correct top/bottom player names for white orientation", () => {
    const isPlayerWhite = true;
    const playerName = "Alice";
    const levelLabel = "Level 3";
    const topName = isPlayerWhite ? `Stockfish ${levelLabel}` : playerName;
    const bottomName = isPlayerWhite ? playerName : `Stockfish ${levelLabel}`;
    expect(topName).toBe("Stockfish Level 3");
    expect(bottomName).toBe("Alice");
  });

  it("correct top/bottom player names for black orientation", () => {
    const isPlayerWhite = false;
    const playerName = "Alice";
    const levelLabel = "Level 5";
    const topName = isPlayerWhite ? `Stockfish ${levelLabel}` : playerName;
    const bottomName = isPlayerWhite ? playerName : `Stockfish ${levelLabel}`;
    expect(topName).toBe("Alice");
    expect(bottomName).toBe("Stockfish Level 5");
  });
});

describe("computer setup color persistence", () => {
  let store: Map<string, string>;
  function getItem(key: string) { return store.get(key) ?? null; }
  function setItem(key: string, value: string) { store.set(key, value); }

  function loadColorChoice(): "white" | "black" | "random" {
    const saved = getItem("computer:colorChoice");
    return saved === "white" || saved === "black" || saved === "random" ? saved : "white";
  }

  beforeEach(() => { store = new Map(); });

  it("defaults to white when nothing stored", () => {
    expect(loadColorChoice()).toBe("white");
  });

  it("restores saved color choice (black)", () => {
    setItem("computer:colorChoice", "black");
    expect(loadColorChoice()).toBe("black");
  });

  it("restores saved color choice (random)", () => {
    setItem("computer:colorChoice", "random");
    expect(loadColorChoice()).toBe("random");
  });

  it("restores saved color choice (white)", () => {
    setItem("computer:colorChoice", "white");
    expect(loadColorChoice()).toBe("white");
  });

  it("falls back to default for invalid color choice", () => {
    setItem("computer:colorChoice", "green");
    expect(loadColorChoice()).toBe("white");
  });

  it("persists color choice on change", () => {
    setItem("computer:colorChoice", "black");
    expect(loadColorChoice()).toBe("black");
    setItem("computer:colorChoice", "random");
    expect(loadColorChoice()).toBe("random");
  });
});

describe("computer game route state", () => {
  it("uses default values when state is empty", () => {
    const state: Record<string, unknown> = {};
    const level = (state.level as number) || 3;
    const color = (state.color as string) || "white";
    expect(level).toBe(3);
    expect(color).toBe("white");
  });

  it("reads values from state correctly", () => {
    const state = { level: 5, color: "black" };
    expect(state.level).toBe(5);
    expect(state.color).toBe("black");
  });

  it("random color resolves to white or black", () => {
    const compColor = "random";
    const actualColor =
      compColor === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : compColor;
    expect(["white", "black"]).toContain(actualColor);
  });

  it("computer games have no time limit", () => {
    const state = { level: 3, color: "white" };
    expect(state).not.toHaveProperty("timeFormat");
  });
});

describe("move duplication guard (gameRef sync update)", () => {
  it("prevents duplicate move when same position is applied twice", () => {
    const startFen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
    const from = "e4";
    const to = "d5";

    let gameRef = new Chess(startFen);
    let moves: string[] = [];

    function applyMove(currentRef: Chess, f: string, t: string): boolean {
      const g = new Chess(currentRef.fen());
      try {
        const move = g.move({ from: f, to: t });
        if (!move) return false;
        gameRef = new Chess(g.fen());
        moves = [...moves, move.san];
        return true;
      } catch {
        return false;
      }
    }

    function isPlayerTurn(): boolean {
      return gameRef.turn() === "w";
    }

    expect(isPlayerTurn()).toBe(true);
    const firstResult = applyMove(gameRef, from, to);
    expect(firstResult).toBe(true);
    expect(moves).toEqual(["exd5"]);
    expect(isPlayerTurn()).toBe(false);

    const secondResult = isPlayerTurn() ? applyMove(gameRef, from, to) : false;
    expect(secondResult).toBe(false);
    expect(moves).toEqual(["exd5"]);
  });

  it("without sync ref update, same move can be applied twice from stale state", () => {
    const startFen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";

    let staleGame = new Chess(startFen);
    let moves: string[] = [];

    function applyMoveNoSync(f: string, t: string): boolean {
      const g = new Chess(staleGame.fen());
      try {
        const move = g.move({ from: f, to: t });
        if (!move) return false;
        moves = [...moves, move.san];
        return true;
      } catch {
        return false;
      }
    }

    applyMoveNoSync("e4", "d5");
    applyMoveNoSync("e4", "d5");
    expect(moves).toEqual(["exd5", "exd5"]);
  });

  it("guard works for non-capture moves too", () => {
    let gameRef = new Chess();
    let moves: string[] = [];

    function applyMove(f: string, t: string): boolean {
      const g = new Chess(gameRef.fen());
      try {
        const move = g.move({ from: f, to: t });
        if (!move) return false;
        gameRef = new Chess(g.fen());
        moves = [...moves, move.san];
        return true;
      } catch {
        return false;
      }
    }

    function isPlayerTurn(): boolean {
      return gameRef.turn() === "w";
    }

    expect(isPlayerTurn()).toBe(true);
    applyMove("e2", "e4");
    expect(isPlayerTurn()).toBe(false);

    const dup = isPlayerTurn() ? applyMove("e2", "e4") : false;
    expect(dup).toBe(false);
    expect(moves).toEqual(["e4"]);
  });
});

describe("auto-save on game finish", () => {
  it("generates an analysisId when game finishes", () => {
    let analysisId: string | null = null;
    const status = "finished";

    if (status === "finished" && !analysisId) {
      analysisId = "test-id-" + Date.now();
    }

    expect(analysisId).not.toBeNull();
    expect(typeof analysisId).toBe("string");
  });

  it("does not regenerate analysisId if already set", () => {
    let analysisId: string | null = "existing-id";
    const status = "finished";

    if (status === "finished" && !analysisId) {
      analysisId = "new-id";
    }

    expect(analysisId).toBe("existing-id");
  });

  it("does not generate analysisId while game is playing", () => {
    let analysisId: string | null = null;
    const status = "playing";

    if (status === "finished" && !analysisId) {
      analysisId = "should-not-happen";
    }

    expect(analysisId).toBeNull();
  });

  it("analysisId is included in saved game state", () => {
    const savedState = {
      level: 3,
      color: "white" as const,
      fen: "some-fen",
      status: "finished" as const,
      result: "1-0",
      gameOverReason: "checkmate",
      moves: ["e4", "e5"],
      lastMove: { from: "e2", to: "e4" },
      analysisId: "my-analysis-id",
    };

    expect(savedState.analysisId).toBe("my-analysis-id");
  });

  it("resumed finished game restores analysisId", () => {
    const saved = {
      level: 3,
      color: "white" as const,
      fen: "some-fen",
      status: "finished" as const,
      result: "1-0",
      gameOverReason: "checkmate",
      moves: ["e4", "e5"],
      lastMove: null,
      analysisId: "restored-id",
    };

    const analysisId = saved.analysisId ?? null;
    expect(analysisId).toBe("restored-id");
  });
});

interface SavedGame {
  level: number;
  color: "white" | "black";
  fen: string;
  status: "playing" | "finished";
  result: string | null;
  gameOverReason: string | null;
  moves: string[];
  lastMove: { from: string; to: string } | null;
  analysisId?: string;
}

function resolveGameState(
  saved: SavedGame | null,
  routeState: { level?: number; color?: "white" | "black" }
) {
  const resuming = saved !== null;
  return {
    resuming,
    level: resuming ? saved!.level : (routeState.level || 3),
    color: resuming ? saved!.color : (routeState.color || "white"),
    fen: resuming ? saved!.fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    status: resuming ? saved!.status : "playing" as const,
    moves: resuming ? saved!.moves : [],
  };
}

describe("computer game persistence across refresh", () => {
  const midGameSave: SavedGame = {
    level: 5,
    color: "black",
    fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    status: "playing",
    result: null,
    gameOverReason: null,
    moves: ["e4", "e6"],
    lastMove: { from: "e7", to: "e6" },
  };

  it("resumes from saved game even when route state is present (refresh scenario)", () => {
    const routeState = { level: 5, color: "black" as const };
    const state = resolveGameState(midGameSave, routeState);

    expect(state.resuming).toBe(true);
    expect(state.fen).toBe(midGameSave.fen);
    expect(state.moves).toEqual(["e4", "e6"]);
    expect(state.status).toBe("playing");
  });

  it("uses saved level/color, not route state, when resuming", () => {
    const routeState = { level: 3, color: "white" as const };
    const state = resolveGameState(midGameSave, routeState);

    expect(state.level).toBe(5);
    expect(state.color).toBe("black");
  });

  it("starts fresh game when no saved state (new game from setup)", () => {
    const routeState = { level: 4, color: "white" as const };
    const state = resolveGameState(null, routeState);

    expect(state.resuming).toBe(false);
    expect(state.level).toBe(4);
    expect(state.color).toBe("white");
    expect(state.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(state.moves).toEqual([]);
  });

  it("falls back to defaults when no saved state and no route state", () => {
    const state = resolveGameState(null, {});

    expect(state.resuming).toBe(false);
    expect(state.level).toBe(3);
    expect(state.color).toBe("white");
  });

  it("resumes a finished game correctly", () => {
    const finishedSave: SavedGame = {
      ...midGameSave,
      status: "finished",
      result: "1-0",
      gameOverReason: "checkmate",
    };
    const state = resolveGameState(finishedSave, { level: 5, color: "black" });

    expect(state.resuming).toBe(true);
    expect(state.status).toBe("finished");
  });

  it("after setup clears saved game, next load starts fresh", () => {
    const state = resolveGameState(null, { level: 2, color: "white" });
    expect(state.resuming).toBe(false);
    expect(state.level).toBe(2);
    expect(state.fen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  });
});
