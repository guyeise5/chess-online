import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULTS,
  parsePartialFromServer,
} from "../hooks/useUserPreferences";

describe("useUserPreferences helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DEFAULTS has expected shape", () => {
    expect(DEFAULTS).toEqual({
      introSeen: false,
      locale: "en",
      boardTheme: "brown",
      pieceSet: "cburnett",
      lobbyColor: "random",
      customMinIdx: 7,
      customIncIdx: 3,
      computerColor: "white",
      puzzleRating: 1500,
      puzzleCount: 0,
    });
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

  it("parsePartialFromServer accepts valid locales only", () => {
    expect(parsePartialFromServer({ locale: "he" })).toEqual({ locale: "he" });
    expect(parsePartialFromServer({ locale: "fr" })).toEqual({ locale: "fr" });
    expect(parsePartialFromServer({ locale: "ru" })).toEqual({ locale: "ru" });
    expect(parsePartialFromServer({ locale: "es" })).toEqual({ locale: "es" });
    expect(parsePartialFromServer({ locale: "en" })).toEqual({ locale: "en" });
    expect(parsePartialFromServer({ locale: "xx" })).toEqual({});
  });

  it("parsePartialFromServer reads all pref fields", () => {
    const raw = {
      introSeen: true,
      locale: "fr",
      boardTheme: "blue",
      pieceSet: "merida",
      lobbyColor: "white",
      customMinIdx: 5,
      customIncIdx: 2,
      computerColor: "black",
      puzzleRating: 1600.5,
      puzzleCount: 10,
    };
    expect(parsePartialFromServer(raw)).toEqual(raw);
  });
});
