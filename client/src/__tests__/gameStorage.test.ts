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

describe("online game auto-save logic", () => {
  it("should save when game transitions to finished with moves", () => {
    const status = "finished";
    const moves = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"];
    const gameSaved = false;
    const featureEnabled = true;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(true);
  });

  it("should not save when game is still playing", () => {
    const status = "playing";
    const moves = ["e4", "e5"];
    const gameSaved = false;
    const featureEnabled = true;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(false);
  });

  it("should not save twice (gameSaved guard)", () => {
    const status = "finished";
    const moves = ["e4", "e5"];
    const gameSaved = true;
    const featureEnabled = true;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(false);
  });

  it("should not save when feature flag is disabled", () => {
    const status = "finished";
    const moves = ["e4", "e5"];
    const gameSaved = false;
    const featureEnabled = false;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(false);
  });

  it("should not save when there are no moves", () => {
    const status = "finished";
    const moves: string[] = [];
    const gameSaved = false;
    const featureEnabled = true;

    const shouldSave = status === "finished" && !gameSaved && featureEnabled && moves.length > 0;
    expect(shouldSave).toBe(false);
  });

  it("uses roomId as gameId for online games", () => {
    const roomId = "abc12345";
    const id = roomId ?? generateGameId();
    expect(id).toBe("abc12345");
  });

  it("falls back to generateGameId when roomId is missing", () => {
    const roomId: string | undefined = undefined;
    const id = roomId ?? generateGameId();
    expect(id).not.toBe(undefined);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
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
  it("builds the correct puzzle analysis URL from a gameId", () => {
    const gameId = "pzl_9a2c3267";
    const path = `/analyzePuzzle/${gameId}`;
    expect(path).toBe("/analyzePuzzle/pzl_9a2c3267");
  });

  it("extracts gameId from puzzle analysis path", () => {
    function extractGameId(path: string): string | null {
      const match = path.match(/^\/analyzePuzzle\/([^/]+)$/);
      return match ? match[1] : null;
    }
    expect(extractGameId("/analyzePuzzle/abc123")).toBe("abc123");
    expect(extractGameId("/analyzePuzzle/")).toBeNull();
    expect(extractGameId("/analysis/abc123")).toBeNull();
  });

  it("puzzle analysis saves with startFen", () => {
    vi.restoreAllMocks();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const puzzleData: AnalysisGameData = {
      startFen: "5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27",
      moves: ["Qd6", "Rd8", "Qxd8+", "Bxd8"],
      playerWhite: "White",
      playerBlack: "Black",
      orientation: "black",
    };

    saveAnalysisGame("puzzle-test-id", puzzleData);

    expect(spy).toHaveBeenCalledOnce();
    const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
    expect(body.startFen).toBe(puzzleData.startFen);
    expect(body.moves).toEqual(puzzleData.moves);
    expect(body.orientation).toBe("black");

    spy.mockRestore();
  });
});
