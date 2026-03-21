import { describe, it, expect } from "vitest";
import { Chess, Square } from "chess.js";

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

describe("time formatting", () => {
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  it("formats 300 seconds as 5:00", () => {
    expect(formatTime(300)).toBe("5:00");
  });

  it("formats 60 seconds as 1:00", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats 0 seconds as 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 90.7 seconds as 1:30", () => {
    expect(formatTime(90.7)).toBe("1:30");
  });

  it("formats 5 seconds as 0:05", () => {
    expect(formatTime(5)).toBe("0:05");
  });

  it("formats 1800 seconds as 30:00", () => {
    expect(formatTime(1800)).toBe("30:00");
  });

  it("formats 599 seconds as 9:59", () => {
    expect(formatTime(599)).toBe("9:59");
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
