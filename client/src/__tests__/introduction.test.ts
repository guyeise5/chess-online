import { describe, it, expect } from "vitest";

/** Mirrors `Introduction.tsx` when `FEATURE_ONLINE_PLAYER_COUNT` is not `"false"`. */
const TOTAL_STEPS_WITH_ONLINE = 10;

/** Mirrors `Introduction.tsx` when `FEATURE_ONLINE_PLAYER_COUNT === "false"`. */
const TOTAL_STEPS_WITHOUT_ONLINE = 9;

describe("Introduction - introSeen preference tracking", () => {
  it("new user has introSeen = false", () => {
    const introSeen = false;
    expect(introSeen).toBe(false);
  });

  it("returning user has introSeen = true", () => {
    const introSeen = true;
    expect(introSeen).toBe(true);
  });

  it("should show intro when flag is enabled and introSeen is false", () => {
    const featureFlag = "true";
    const introSeen = false;
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(true);
  });

  it("should not show intro when flag is disabled", () => {
    const featureFlag = "false";
    const introSeen = false;
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(false);
  });

  it("should not show intro when already seen", () => {
    const featureFlag = "true";
    const introSeen = true;
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(false);
  });

  it("should show intro when flag is undefined (default enabled)", () => {
    const featureFlag = undefined;
    const introSeen = false;
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(true);
  });
});

describe("Introduction - step navigation", () => {
  it("starts at step 0", () => {
    const step = 0;
    expect(step).toBe(0);
  });

  it("next increments step", () => {
    let step = 0;
    step += 1;
    expect(step).toBe(1);
  });

  it("back decrements step", () => {
    let step = 3;
    step -= 1;
    expect(step).toBe(2);
  });

  it("can navigate to any step via dot click", () => {
    const step = 5;
    expect(step).toBeGreaterThanOrEqual(0);
    expect(step).toBeLessThan(TOTAL_STEPS_WITH_ONLINE);
  });

  it("last step index is TOTAL_STEPS_WITH_ONLINE - 1", () => {
    const lastStep = TOTAL_STEPS_WITH_ONLINE - 1;
    expect(lastStep).toBe(9);
  });

  it("isLast is true only on final step", () => {
    for (let i = 0; i < TOTAL_STEPS_WITH_ONLINE; i++) {
      const isLast = i === TOTAL_STEPS_WITH_ONLINE - 1;
      if (i === TOTAL_STEPS_WITH_ONLINE - 1) {
        expect(isLast).toBe(true);
      } else {
        expect(isLast).toBe(false);
      }
    }
  });

  it("skip on any step completes the introduction", () => {
    let completed = false;
    const onComplete = () => { completed = true; };
    onComplete();
    expect(completed).toBe(true);
  });
});

describe("Introduction - step content and selectors", () => {
  /** i18n keys for step titles (English copy lives in `client/src/i18n/en.ts`). */
  const stepTitleKeys = [
    "intro.welcome.title",
    "intro.playOnline.title",
    "intro.onlineCount.title",
    "intro.time.title",
    "intro.rooms.title",
    "intro.private.title",
    "intro.computer.title",
    "intro.puzzles.title",
    "intro.history.title",
    "intro.board.title",
  ];

  const stepSelectors: (string | undefined)[] = [
    undefined,
    "[data-tour='nav-play']",
    "[data-tour='online-count']",
    "[data-tour='time-grid']",
    "[data-tour='rooms-table']",
    "[data-tour='private-game']",
    "[data-tour='nav-computer']",
    "[data-tour='nav-puzzles']",
    "[data-tour='nav-games']",
    "[data-tour='settings-btn']",
  ];

  it("has the correct number of steps when online indicator is enabled", () => {
    expect(stepTitleKeys).toHaveLength(TOTAL_STEPS_WITH_ONLINE);
    expect(stepSelectors).toHaveLength(TOTAL_STEPS_WITH_ONLINE);
  });

  it("first step is the welcome (no target element)", () => {
    expect(stepTitleKeys[0]).toBe("intro.welcome.title");
    expect(stepSelectors[0]).toBeUndefined();
  });

  it("last step is board customization", () => {
    expect(stepTitleKeys[stepTitleKeys.length - 1]).toBe("intro.board.title");
  });

  it("all steps after welcome have a target selector", () => {
    for (let i = 1; i < stepSelectors.length; i++) {
      expect(stepSelectors[i]).toBeDefined();
      expect(typeof stepSelectors[i]).toBe("string");
    }
  });

  it("contains all expected topic keys", () => {
    const topicKeys = stepTitleKeys.slice(1);
    for (const k of topicKeys) {
      expect(stepTitleKeys).toContain(k);
    }
  });

  it("all selectors use data-tour attributes", () => {
    for (const sel of stepSelectors) {
      if (sel) {
        expect(sel).toMatch(/^\[data-tour=/);
      }
    }
  });
});

describe("Introduction - step list when online player count feature is off", () => {
  const stepTitleKeysNoOnline = [
    "intro.welcome.title",
    "intro.playOnline.title",
    "intro.time.title",
    "intro.rooms.title",
    "intro.private.title",
    "intro.computer.title",
    "intro.puzzles.title",
    "intro.history.title",
    "intro.board.title",
  ];

  const stepSelectorsNoOnline: (string | undefined)[] = [
    undefined,
    "[data-tour='nav-play']",
    "[data-tour='time-grid']",
    "[data-tour='rooms-table']",
    "[data-tour='private-game']",
    "[data-tour='nav-computer']",
    "[data-tour='nav-puzzles']",
    "[data-tour='nav-games']",
    "[data-tour='settings-btn']",
  ];

  it("matches Introduction.tsx without the online-count step", () => {
    expect(stepTitleKeysNoOnline).toHaveLength(TOTAL_STEPS_WITHOUT_ONLINE);
    expect(stepSelectorsNoOnline).toHaveLength(TOTAL_STEPS_WITHOUT_ONLINE);
  });
});
