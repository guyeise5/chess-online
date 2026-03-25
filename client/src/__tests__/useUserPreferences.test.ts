import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULTS,
  loadLocal,
  saveLocal,
  parsePartialFromServer,
} from "../hooks/useUserPreferences";

function attachMockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("localStorage", ls);
  return store;
}

describe("useUserPreferences helpers", () => {
  beforeEach(() => {
    attachMockLocalStorage();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadLocal returns DEFAULTS when storage is empty", () => {
    expect(loadLocal()).toEqual(DEFAULTS);
  });

  it("loadLocal parses valid stored JSON", () => {
    const stored = {
      introSeen: true,
      boardTheme: "blue",
      pieceSet: "merida",
      lobbyColor: "white",
      customMinIdx: 5,
      customIncIdx: 2,
      computerColor: "black",
      puzzleRating: 1600.5,
      puzzleCount: 10,
    };
    localStorage.setItem("chess-user-prefs", JSON.stringify(stored));
    expect(loadLocal()).toEqual(stored);
  });

  it("loadLocal falls back per field for invalid types", () => {
    localStorage.setItem(
      "chess-user-prefs",
      JSON.stringify({
        introSeen: "yes",
        boardTheme: 123,
        pieceSet: null,
        lobbyColor: [],
        customMinIdx: "not-a-number",
        customIncIdx: NaN,
        computerColor: {},
        puzzleRating: "x",
        puzzleCount: Infinity,
      })
    );
    expect(loadLocal()).toEqual(DEFAULTS);
  });

  it("loadLocal returns DEFAULTS for non-object JSON", () => {
    localStorage.setItem("chess-user-prefs", JSON.stringify(null));
    expect(loadLocal()).toEqual(DEFAULTS);
    localStorage.setItem("chess-user-prefs", JSON.stringify([1, 2]));
    expect(loadLocal()).toEqual(DEFAULTS);
  });

  it("saveLocal round-trips", () => {
    const prefs = { ...DEFAULTS, introSeen: true, puzzleRating: 1400 };
    saveLocal(prefs);
    expect(loadLocal()).toEqual(prefs);
  });

  it("parsePartialFromServer reads nested data object", () => {
    expect(
      parsePartialFromServer({
        data: { introSeen: true, puzzleRating: 1200 },
      })
    ).toEqual({ introSeen: true, puzzleRating: 1200 });
  });

  it("parsePartialFromServer ignores invalid fields", () => {
    expect(
      parsePartialFromServer({
        introSeen: "no",
        puzzleRating: NaN,
        puzzleCount: "abc",
      })
    ).toEqual({});
  });
});
