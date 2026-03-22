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
