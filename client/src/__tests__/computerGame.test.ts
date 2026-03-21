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
  { level: 1, skillLevel: 0, depth: 1, label: "Level 1", rating: "~800" },
  { level: 2, skillLevel: 2, depth: 2, label: "Level 2", rating: "~1100" },
  { level: 3, skillLevel: 5, depth: 4, label: "Level 3", rating: "~1400" },
  { level: 4, skillLevel: 8, depth: 6, label: "Level 4", rating: "~1700" },
  { level: 5, skillLevel: 11, depth: 9, label: "Level 5", rating: "~2000" },
  { level: 6, skillLevel: 14, depth: 12, label: "Level 6", rating: "~2300" },
  { level: 7, skillLevel: 17, depth: 16, label: "Level 7", rating: "~2700" },
  { level: 8, skillLevel: 20, depth: 22, label: "Level 8", rating: "~3000" },
];

function getLevelConfig(level: number): StockfishLevel {
  return STOCKFISH_LEVELS[Math.max(0, Math.min(level - 1, 7))];
}

describe("Stockfish level mapping", () => {
  it("has 8 levels", () => {
    expect(STOCKFISH_LEVELS).toHaveLength(8);
  });

  it("level 1 is the weakest (skill 0, depth 1)", () => {
    const cfg = getLevelConfig(1);
    expect(cfg.skillLevel).toBe(0);
    expect(cfg.depth).toBe(1);
  });

  it("level 8 is full strength (skill 20, depth 22)", () => {
    const cfg = getLevelConfig(8);
    expect(cfg.skillLevel).toBe(20);
    expect(cfg.depth).toBe(22);
  });

  it("skill level increases monotonically", () => {
    for (let i = 1; i < STOCKFISH_LEVELS.length; i++) {
      expect(STOCKFISH_LEVELS[i].skillLevel).toBeGreaterThan(
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
    expect(getLevelConfig(99)).toEqual(STOCKFISH_LEVELS[7]);
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
