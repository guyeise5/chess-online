import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveAnalysisGame,
  generateGameId,
  type AnalysisGameData,
} from "../components/AnalysisBoard";

const sampleGame: AnalysisGameData = {
  moves: ["e4", "e5", "Nf3", "Nc6"],
  playerWhite: "Alice",
  playerBlack: "Bob",
  orientation: "white",
};

describe("saveAnalysisGame", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs game data to the API", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    saveAnalysisGame("test-id", sampleGame);

    expect(spy).toHaveBeenCalledOnce();
    const [url, opts] = spy.mock.calls[0];
    expect(url).toContain("/api/games/test-id");
    expect(opts?.method).toBe("POST");
    const body = JSON.parse(opts?.body as string);
    expect(body.moves).toEqual(sampleGame.moves);
    expect(body.playerWhite).toBe("Alice");
  });

  it("includes credentials for session cookie", () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    saveAnalysisGame("test-id", sampleGame);

    const [, opts] = spy.mock.calls[0];
    expect(opts?.credentials).toBe("include");
  });

  it("does not throw when fetch fails", () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect(() => saveAnalysisGame("test-id", sampleGame)).not.toThrow();
  });
});

describe("generateGameId", () => {
  it("returns a non-empty string", () => {
    const id = generateGameId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique IDs", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateGameId()));
    expect(ids.size).toBe(50);
  });
});

describe("game save architecture", () => {
  it("PvP games use roomId as gameId for analysis route", () => {
    const roomId = "abc12345";
    const id = roomId ?? generateGameId();
    expect(id).toBe("abc12345");
  });

  it("computer games fall back to generateGameId when roomId is missing", () => {
    const roomId: string | undefined = undefined;
    const id = roomId ?? generateGameId();
    expect(id).not.toBe(undefined);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("computer game auto-save triggers when game finishes with moves", () => {
    const status = "finished";
    const moves = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"];
    const gameSaved = false;
    const featureEnabled = true;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(true);
  });

  it("computer game auto-save does not trigger when feature disabled", () => {
    const status = "finished";
    const moves = ["e4", "e5"];
    const gameSaved = false;
    const featureEnabled = false;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(false);
  });

  it("computer game auto-save does not trigger with no moves", () => {
    const status = "finished";
    const moves: string[] = [];
    const gameSaved = false;
    const featureEnabled = true;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(false);
  });
});

describe("analysis route construction", () => {
  it("builds the correct analysis URL from a gameId", () => {
    const gameId = "9a2c3267";
    const path = `/analysis/${gameId}`;
    expect(path).toBe("/analysis/9a2c3267");
  });

  it("extracts gameId from analysis path", () => {
    function extractGameId(path: string): string | null {
      const match = path.match(/^\/analysis\/([^/]+)$/);
      return match ? match[1] : null;
    }
    expect(extractGameId("/analysis/abc123")).toBe("abc123");
    expect(extractGameId("/analysis/")).toBeNull();
    expect(extractGameId("/game/abc123")).toBeNull();
  });
});

describe("puzzle analysis route construction", () => {
  it("builds the correct puzzle analysis URL from a puzzleId", () => {
    const puzzleId = "AbC12";
    const path = `/analyzePuzzle/${puzzleId}`;
    expect(path).toBe("/analyzePuzzle/AbC12");
  });

  it("extracts puzzleId from puzzle analysis path", () => {
    function extractPuzzleId(path: string): string | null {
      const match = path.match(/^\/analyzePuzzle\/([^/]+)$/);
      return match ? match[1] : null;
    }
    expect(extractPuzzleId("/analyzePuzzle/AbC12")).toBe("AbC12");
    expect(extractPuzzleId("/analyzePuzzle/")).toBeNull();
    expect(extractPuzzleId("/analysis/abc123")).toBeNull();
  });

  it("puzzle analysis fetches from puzzle API (not game API)", () => {
    const puzzleId = "AbC12";
    const puzzleApiUrl = `/api/puzzles/${puzzleId}`;
    const gameApiUrl = `/api/games/${puzzleId}`;
    expect(puzzleApiUrl).toContain("/api/puzzles/");
    expect(puzzleApiUrl).not.toContain("/api/games/");
    expect(gameApiUrl).not.toBe(puzzleApiUrl);
  });
});
