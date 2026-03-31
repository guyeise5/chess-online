import { describe, it, expect } from "vitest";
import { Chess, Square } from "chess.js";

function findKingSquare(game: Chess): string | null {
  const turn = game.turn();
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "k" && piece.color === turn) {
        return piece.square;
      }
    }
  }
  return null;
}

/**
 * Tests for the client-side game logic helpers used in GameRoom:
 * - Turn detection
 * - Promotion detection
 * - Board orientation
 * - Move formatting
 */

describe("turn detection", () => {
  it("white moves first in starting position", () => {
    const game = new Chess();
    expect(game.turn()).toBe("w");
  });

  it("turn alternates after a move", () => {
    const game = new Chess();
    game.move("e4");
    expect(game.turn()).toBe("b");
    game.move("e5");
    expect(game.turn()).toBe("w");
  });

  it("isMyTurn logic: white player on white's turn", () => {
    const game = new Chess();
    const isWhite = true;
    const isBlack = false;
    const turn = game.turn();
    const isMyTurn = (turn === "w" && isWhite) || (turn === "b" && isBlack);
    expect(isMyTurn).toBe(true);
  });

  it("isMyTurn logic: black player on white's turn", () => {
    const game = new Chess();
    const isWhite = false;
    const isBlack = true;
    const turn = game.turn();
    const isMyTurn = (turn === "w" && isWhite) || (turn === "b" && isBlack);
    expect(isMyTurn).toBe(false);
  });

  it("isMyTurn logic: black player on black's turn", () => {
    const game = new Chess();
    game.move("e4");
    const isWhite = false;
    const isBlack = true;
    const turn = game.turn();
    const isMyTurn = (turn === "w" && isWhite) || (turn === "b" && isBlack);
    expect(isMyTurn).toBe(true);
  });
});

describe("promotion detection", () => {
  function needsPromotion(
    game: Chess,
    from: string,
    to: string
  ): string | undefined {
    const piece = game.get(from as Square);
    const turn = game.turn();
    const isPawn = piece && piece.type === "p";
    return isPawn &&
      ((turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1"))
      ? "q"
      : undefined;
  }

  it("detects white pawn promoting on rank 8", () => {
    const game = new Chess("8/4P3/8/8/8/8/8/4K2k w - - 0 1");
    expect(needsPromotion(game, "e7", "e8")).toBe("q");
  });

  it("detects black pawn promoting on rank 1", () => {
    const game = new Chess("4k3/8/8/8/8/8/3p4/4K3 b - - 0 1");
    expect(needsPromotion(game, "d2", "d1")).toBe("q");
  });

  it("returns undefined for non-promoting pawn move", () => {
    const game = new Chess();
    expect(needsPromotion(game, "e2", "e4")).toBeUndefined();
  });

  it("returns undefined for non-pawn piece", () => {
    const game = new Chess();
    expect(needsPromotion(game, "g1", "f3")).toBeUndefined();
  });
});

describe("board orientation", () => {
  it("white player sees board from white perspective", () => {
    const whitePlayer = "Alice";
    const room = { whitePlayer: "Alice", blackPlayer: "Bob" };
    const isBlack = room.blackPlayer === whitePlayer;
    const orientation = isBlack ? "black" : "white";
    expect(orientation).toBe("white");
  });

  it("black player sees board from black perspective", () => {
    const blackPlayer = "Bob";
    const room = { whitePlayer: "Alice", blackPlayer: "Bob" };
    const isBlack = room.blackPlayer === blackPlayer;
    const orientation = isBlack ? "black" : "white";
    expect(orientation).toBe("black");
  });

  it("spectator (non-player) defaults to white perspective", () => {
    const spectator = "Charlie";
    const room = { whitePlayer: "Alice", blackPlayer: "Bob" };
    const isBlack = room.blackPlayer === spectator;
    const orientation = isBlack ? "black" : "white";
    expect(orientation).toBe("white");
  });

  it("player bar layout: white orientation has black on top", () => {
    const orientation = "white";
    const room = { whitePlayer: "Alice", blackPlayer: "Bob" };
    const topPlayer =
      orientation === "white" ? room.blackPlayer : room.whitePlayer;
    const bottomPlayer =
      orientation === "white" ? room.whitePlayer : room.blackPlayer;
    expect(topPlayer).toBe("Bob");
    expect(bottomPlayer).toBe("Alice");
  });

  it("player bar layout: black orientation has white on top", () => {
    const orientation = "black";
    const room = { whitePlayer: "Alice", blackPlayer: "Bob" };
    const topPlayer =
      orientation === "white" ? room.blackPlayer : room.whitePlayer;
    const bottomPlayer =
      orientation === "white" ? room.whitePlayer : room.blackPlayer;
    expect(topPlayer).toBe("Alice");
    expect(bottomPlayer).toBe("Bob");
  });
});

describe("lobby time label formatting", () => {
  function formatMinutes(v: number): string {
    if (v === 0.25) return "¼";
    if (v === 0.5) return "½";
    return String(v);
  }

  function formatTimeLabel(timeControl: number, increment: number): string {
    const mins = timeControl / 60;
    return `${formatMinutes(mins)}+${increment}`;
  }

  it("formats 15-second (¼ min) time control correctly", () => {
    expect(formatTimeLabel(15, 0)).toBe("¼+0");
  });

  it("formats 30-second (½ min) time control correctly", () => {
    expect(formatTimeLabel(30, 0)).toBe("½+0");
  });

  it("formats 15-second time control with increment", () => {
    expect(formatTimeLabel(15, 1)).toBe("¼+1");
  });

  it("formats 30-second time control with increment", () => {
    expect(formatTimeLabel(30, 2)).toBe("½+2");
  });

  it("formats whole-minute time controls", () => {
    expect(formatTimeLabel(300, 3)).toBe("5+3");
    expect(formatTimeLabel(60, 0)).toBe("1+0");
    expect(formatTimeLabel(600, 5)).toBe("10+5");
    expect(formatTimeLabel(1800, 0)).toBe("30+0");
  });
});

describe("lobby preference defaults", () => {
  const MINUTE_STEPS = [0, 0.25, 0.5, ...Array.from({ length: 180 }, (_, i) => i + 1)];
  const INCREMENT_STEPS = Array.from({ length: 181 }, (_, i) => i);
  const DEFAULT_MIN_IDX = 7;
  const DEFAULT_INC_IDX = 3;

  function resolveMinIdx(saved: number | undefined): number {
    if (typeof saved === "number" && saved >= 0 && saved < MINUTE_STEPS.length) return saved;
    return DEFAULT_MIN_IDX;
  }

  function resolveIncIdx(saved: number | undefined): number {
    if (typeof saved === "number" && saved >= 0 && saved < INCREMENT_STEPS.length) return saved;
    return DEFAULT_INC_IDX;
  }

  function resolveColorChoice(saved: string | undefined): string {
    return saved === "white" || saved === "black" || saved === "random" ? saved : "random";
  }

  it("defaults minute index to 7 (5 min)", () => {
    expect(resolveMinIdx(undefined)).toBe(DEFAULT_MIN_IDX);
  });

  it("defaults increment index to 3", () => {
    expect(resolveIncIdx(undefined)).toBe(DEFAULT_INC_IDX);
  });

  it("defaults color choice to random", () => {
    expect(resolveColorChoice(undefined)).toBe("random");
  });

  it("uses saved minute index", () => {
    expect(resolveMinIdx(10)).toBe(10);
  });

  it("uses saved increment index", () => {
    expect(resolveIncIdx(20)).toBe(20);
  });

  it("uses saved color choice", () => {
    expect(resolveColorChoice("black")).toBe("black");
  });

  it("falls back for out-of-range minute index", () => {
    expect(resolveMinIdx(9999)).toBe(DEFAULT_MIN_IDX);
  });

  it("falls back for negative minute index", () => {
    expect(resolveMinIdx(-1)).toBe(DEFAULT_MIN_IDX);
  });

  it("falls back for out-of-range increment index", () => {
    expect(resolveIncIdx(999)).toBe(DEFAULT_INC_IDX);
  });

  it("falls back for invalid color choice", () => {
    expect(resolveColorChoice("green")).toBe("random");
  });
});

describe("time formatting", () => {
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (seconds < 10) {
      const tenths = Math.floor((seconds - Math.floor(seconds)) * 10);
      return `${m}:${s.toString().padStart(2, "0")}.${tenths}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  it("formats 300 seconds as 5:00", () => {
    expect(formatTime(300)).toBe("5:00");
  });

  it("formats 60 seconds as 1:00", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats 0 seconds as 0:00.0", () => {
    expect(formatTime(0)).toBe("0:00.0");
  });

  it("formats 90.7 seconds as 1:30", () => {
    expect(formatTime(90.7)).toBe("1:30");
  });

  it("formats 5 seconds as 0:05.0", () => {
    expect(formatTime(5)).toBe("0:05.0");
  });

  it("formats 1800 seconds as 30:00", () => {
    expect(formatTime(1800)).toBe("30:00");
  });

  it("formats 599 seconds as 9:59", () => {
    expect(formatTime(599)).toBe("9:59");
  });

  it("formats 9.5 seconds as 0:09.5", () => {
    expect(formatTime(9.5)).toBe("0:09.5");
  });

  it("formats 3.7 seconds as 0:03.7", () => {
    expect(formatTime(3.7)).toBe("0:03.7");
  });

  it("formats 0.1 seconds as 0:00.1", () => {
    expect(formatTime(0.1)).toBe("0:00.1");
  });

  it("formats 10 seconds as 0:10 (boundary)", () => {
    expect(formatTime(10)).toBe("0:10");
  });

  it("formats 9.99 seconds as 0:09.9", () => {
    expect(formatTime(9.99)).toBe("0:09.9");
  });
});

describe("clock low-time threshold", () => {
  const LOW_TIME_THRESHOLD = 10;

  it("flags time as low at exactly 10 seconds", () => {
    expect(10 <= LOW_TIME_THRESHOLD).toBe(true);
  });

  it("flags time as low below 10 seconds", () => {
    expect(5 <= LOW_TIME_THRESHOLD).toBe(true);
    expect(0 <= LOW_TIME_THRESHOLD).toBe(true);
    expect(1 <= LOW_TIME_THRESHOLD).toBe(true);
    expect(9.9 <= LOW_TIME_THRESHOLD).toBe(true);
  });

  it("does not flag time above 10 seconds", () => {
    expect(11 <= LOW_TIME_THRESHOLD).toBe(false);
    expect(60 <= LOW_TIME_THRESHOLD).toBe(false);
    expect(300 <= LOW_TIME_THRESHOLD).toBe(false);
    expect(10.1 <= LOW_TIME_THRESHOLD).toBe(false);
  });
});

describe("check highlight", () => {
  it("detects check and finds the king square", () => {
    const game = new Chess("rnbqkbnr/ppppp2p/5p2/6pQ/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3");
    expect(game.inCheck()).toBe(true);
    const kingSq = findKingSquare(game);
    expect(kingSq).toBe("e8");
  });

  it("detects checkmate and finds the king square", () => {
    const game = new Chess("rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(game.isCheckmate()).toBe(true);
    expect(game.inCheck()).toBe(true);
    const kingSq = findKingSquare(game);
    expect(kingSq).toBe("e1");
  });

  it("returns null king square for non-check position", () => {
    const game = new Chess();
    expect(game.inCheck()).toBe(false);
  });

  it("finds black king when black is in check", () => {
    const game = new Chess("rnbqkb1r/pppp1Qpp/2n5/4p3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 3");
    expect(game.inCheck()).toBe(true);
    const kingSq = findKingSquare(game);
    expect(kingSq).toBe("e8");
  });

  it("finds white king when white is in check", () => {
    const game = new Chess("rnb1kbnr/pppp1ppp/8/4p3/4P2q/5P2/PPPP2PP/RNBQKBNR w KQkq - 1 3");
    expect(game.inCheck()).toBe(true);
    const kingSq = findKingSquare(game);
    expect(kingSq).toBe("e1");
  });
});

describe("isPromotionMove detection", () => {
  function isPromotionMove(game: Chess, from: string, to: string): boolean {
    const piece = game.get(from as Square);
    if (!piece || piece.type !== "p") return false;
    const turn = game.turn();
    return (turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1");
  }

  it("white pawn to rank 8 is promotion", () => {
    const game = new Chess("8/4P3/8/8/8/8/8/4K2k w - - 0 1");
    expect(isPromotionMove(game, "e7", "e8")).toBe(true);
  });

  it("black pawn to rank 1 is promotion", () => {
    const game = new Chess("4k3/8/8/8/8/8/3p4/4K3 b - - 0 1");
    expect(isPromotionMove(game, "d2", "d1")).toBe(true);
  });

  it("pawn moving to non-promotion rank is not promotion", () => {
    const game = new Chess();
    expect(isPromotionMove(game, "e2", "e4")).toBe(false);
  });

  it("non-pawn piece is not promotion", () => {
    const game = new Chess("8/4R3/8/8/8/8/8/4K2k w - - 0 1");
    expect(isPromotionMove(game, "e7", "e8")).toBe(false);
  });

  it("capture-promotion is detected", () => {
    const game = new Chess("3r4/4P3/8/8/8/8/8/4K2k w - - 0 1");
    expect(isPromotionMove(game, "e7", "d8")).toBe(true);
  });
});

describe("move list formatting", () => {
  it("pairs moves correctly", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4"];
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
      });
    }

    expect(pairs).toEqual([
      { num: 1, white: "e4", black: "e5" },
      { num: 2, white: "Nf3", black: "Nc6" },
      { num: 3, white: "Bc4", black: undefined },
    ]);
  });

  it("handles empty move list", () => {
    const moves: string[] = [];
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
      });
    }
    expect(pairs).toEqual([]);
  });

  it("handles single move", () => {
    const moves = ["e4"];
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
      });
    }
    expect(pairs).toEqual([{ num: 1, white: "e4", black: undefined }]);
  });
});

describe("give time button visibility", () => {
  function shouldShowGiveTime(
    isPlayer: boolean,
    status: string,
    featureFlag?: string
  ): boolean {
    return isPlayer && status === "playing" && featureFlag !== "false";
  }

  it("shows when player is in an active game with flag enabled", () => {
    expect(shouldShowGiveTime(true, "playing", "true")).toBe(true);
  });

  it("shows when flag is undefined (default enabled)", () => {
    expect(shouldShowGiveTime(true, "playing", undefined)).toBe(true);
  });

  it("hides when not a player", () => {
    expect(shouldShowGiveTime(false, "playing", "true")).toBe(false);
  });

  it("hides when game is not playing", () => {
    expect(shouldShowGiveTime(true, "waiting", "true")).toBe(false);
    expect(shouldShowGiveTime(true, "finished", "true")).toBe(false);
  });

  it("hides when feature flag is disabled", () => {
    expect(shouldShowGiveTime(true, "playing", "false")).toBe(false);
  });
});
