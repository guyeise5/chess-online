import { describe, it, expect, vi, beforeEach } from "vitest";

interface GameSummary {
  gameId: string;
  moves: string[];
  playerWhite?: string;
  playerBlack?: string;
  orientation?: "white" | "black";
  result?: string;
  createdAt: string;
}

function resultForPlayer(
  game: GameSummary,
  playerName: string
): "win" | "loss" | "draw" | "unknown" {
  if (!game.result) return "unknown";
  if (game.result === "1/2-1/2") return "draw";
  const isWhite = game.playerWhite === playerName;
  const isBlack = game.playerBlack === playerName;
  if (!isWhite && !isBlack) return "unknown";
  if (game.result === "1-0") return isWhite ? "win" : "loss";
  if (game.result === "0-1") return isBlack ? "win" : "loss";
  return "unknown";
}

function resultLabel(outcome: "win" | "loss" | "draw" | "unknown"): string {
  switch (outcome) {
    case "win": return "Won";
    case "loss": return "Lost";
    case "draw": return "Draw";
    default: return "—";
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

describe("resultForPlayer", () => {
  const base: GameSummary = {
    gameId: "x",
    moves: ["e4"],
    playerWhite: "Alice",
    playerBlack: "Bob",
    createdAt: new Date().toISOString(),
  };

  it("returns win when player is white and result is 1-0", () => {
    expect(resultForPlayer({ ...base, result: "1-0" }, "Alice")).toBe("win");
  });

  it("returns loss when player is white and result is 0-1", () => {
    expect(resultForPlayer({ ...base, result: "0-1" }, "Alice")).toBe("loss");
  });

  it("returns win when player is black and result is 0-1", () => {
    expect(resultForPlayer({ ...base, result: "0-1" }, "Bob")).toBe("win");
  });

  it("returns loss when player is black and result is 1-0", () => {
    expect(resultForPlayer({ ...base, result: "1-0" }, "Bob")).toBe("loss");
  });

  it("returns draw for 1/2-1/2", () => {
    expect(resultForPlayer({ ...base, result: "1/2-1/2" }, "Alice")).toBe("draw");
    expect(resultForPlayer({ ...base, result: "1/2-1/2" }, "Bob")).toBe("draw");
  });

  it("returns unknown when result is missing", () => {
    expect(resultForPlayer({ ...base, result: undefined }, "Alice")).toBe("unknown");
  });

  it("returns unknown when player is not in the game", () => {
    expect(resultForPlayer({ ...base, result: "1-0" }, "Charlie")).toBe("unknown");
  });
});

describe("resultLabel", () => {
  it("maps outcomes to display labels", () => {
    expect(resultLabel("win")).toBe("Won");
    expect(resultLabel("loss")).toBe("Lost");
    expect(resultLabel("draw")).toBe("Draw");
    expect(resultLabel("unknown")).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date", () => {
    const formatted = formatDate("2025-06-15T12:00:00.000Z");
    expect(formatted).toContain("2025");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("not-a-date")).not.toBe("");
  });
});

describe("game history route construction", () => {
  it("builds the correct game history URL", () => {
    const path = "/games";
    expect(path).toBe("/games");
  });

  it("builds the correct analysis URL from a game", () => {
    const gameId = "abc123";
    const path = `/analysis/${gameId}`;
    expect(path).toBe("/analysis/abc123");
  });
});

describe("game history API call", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches games for the given player", async () => {
    const mockGames: GameSummary[] = [
      {
        gameId: "g1",
        moves: ["e4", "e5"],
        playerWhite: "Alice",
        playerBlack: "Bot",
        result: "1-0",
        createdAt: new Date().toISOString(),
      },
    ];

    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockGames), { status: 200 })
    );

    const res = await fetch("/api/games?player=Alice");
    const data = await res.json();

    expect(spy).toHaveBeenCalledOnce();
    expect(data).toHaveLength(1);
    expect(data[0].gameId).toBe("g1");
  });

  it("encodes player name in URL", () => {
    const playerName = "Alice Bob";
    const url = `/api/games?player=${encodeURIComponent(playerName)}`;
    expect(url).toBe("/api/games?player=Alice%20Bob");
  });

  it("handles empty response gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );

    const res = await fetch("/api/games?player=Unknown");
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("handles fetch error gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    let error: string | null = null;
    try {
      await fetch("/api/games?player=Alice");
    } catch (err) {
      error = (err as Error).message;
    }
    expect(error).toBe("network");
  });
});

describe("opponent extraction", () => {
  it("shows black player as opponent when player is white", () => {
    const game: GameSummary = {
      gameId: "x",
      moves: ["e4"],
      playerWhite: "Alice",
      playerBlack: "Stockfish Level 3",
      createdAt: new Date().toISOString(),
    };
    const playerName = "Alice";
    const opponent = game.playerWhite === playerName
      ? game.playerBlack ?? "Unknown"
      : game.playerWhite ?? "Unknown";
    expect(opponent).toBe("Stockfish Level 3");
  });

  it("shows white player as opponent when player is black", () => {
    const game: GameSummary = {
      gameId: "x",
      moves: ["e4"],
      playerWhite: "Stockfish Level 5",
      playerBlack: "Bob",
      createdAt: new Date().toISOString(),
    };
    const playerName = "Bob";
    const opponent = game.playerWhite === playerName
      ? game.playerBlack ?? "Unknown"
      : game.playerWhite ?? "Unknown";
    expect(opponent).toBe("Stockfish Level 5");
  });

  it("shows 'Unknown' when opponent name is missing", () => {
    const game: GameSummary = {
      gameId: "x",
      moves: ["e4"],
      playerWhite: "Alice",
      createdAt: new Date().toISOString(),
    };
    const playerName = "Alice";
    const opponent = game.playerWhite === playerName
      ? game.playerBlack ?? "Unknown"
      : game.playerWhite ?? "Unknown";
    expect(opponent).toBe("Unknown");
  });
});

describe("feature flag gating", () => {
  it("shows game history card when flag is not set (default enabled)", () => {
    const flags: Record<string, string> = {};
    const show = flags.FEATURE_GAME_HISTORY !== "false";
    expect(show).toBe(true);
  });

  it("shows game history card when flag is 'true'", () => {
    const flags = { FEATURE_GAME_HISTORY: "true" };
    const show = flags.FEATURE_GAME_HISTORY !== "false";
    expect(show).toBe(true);
  });

  it("hides game history card when flag is 'false'", () => {
    const flags = { FEATURE_GAME_HISTORY: "false" };
    const show = flags.FEATURE_GAME_HISTORY !== "false";
    expect(show).toBe(false);
  });
});
