import { describe, it, expect } from "vitest";
import { applyTemplate } from "../i18n/I18nProvider";
import { translateEndgameReason } from "../i18n/gameReason";
import { translateSystemChat } from "../i18n/systemChat";
import { timeCategoryKey, timeFormatToKey } from "../i18n/timeCategory";
import { en } from "../i18n/en";
import { he } from "../i18n/he";

describe("i18n helpers", () => {
  it("applyTemplate replaces {{key}} placeholders", () => {
    expect(applyTemplate("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("timeFormatToKey maps server enum to dictionary keys", () => {
    expect(timeFormatToKey("blitz")).toBe("time.blitz");
  });

  it("timeCategoryKey matches Lichess-style buckets", () => {
    expect(timeCategoryKey(1, 0)).toBe("time.bullet");
    expect(timeCategoryKey(5, 0)).toBe("time.blitz");
  });

  it("translateEndgameReason leaves English unchanged", () => {
    const t = (k: string) => en[k] ?? k;
    expect(translateEndgameReason("checkmate", "en", t)).toBe("checkmate");
  });

  it("translateEndgameReason maps known reasons in Hebrew", () => {
    const t = (k: string) => he[k] ?? k;
    expect(translateEndgameReason("checkmate", "he", t)).toBe(he["reason.checkmate"]);
  });

  it("translateSystemChat passes through English", () => {
    const t = (k: string) => en[k] ?? k;
    expect(translateSystemChat("Game started — good luck!", "en", t)).toBe(
      "Game started — good luck!"
    );
  });

  it("translateSystemChat localizes fixed Hebrew lines", () => {
    const t = (k: string, vars?: Record<string, string>) =>
      applyTemplate(he[k] ?? k, vars);
    expect(translateSystemChat("Game started — good luck!", "he", t)).toBe(
      he["chat.system.gameStarted"]
    );
  });
});
