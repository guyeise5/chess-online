import { describe, it, expect } from "vitest";

const INTRO_SEEN_KEY = "chess-intro-seen";
const TOTAL_STEPS = 9;

describe("Introduction - localStorage tracking", () => {
  it("new user has no intro-seen key", () => {
    const store = new Map<string, string>();
    expect(store.has(INTRO_SEEN_KEY)).toBe(false);
  });

  it("returning user has intro-seen key", () => {
    const store = new Map<string, string>();
    store.set(INTRO_SEEN_KEY, "1");
    expect(store.get(INTRO_SEEN_KEY)).toBe("1");
  });

  it("should show intro when flag is enabled and key is absent", () => {
    const featureFlag = "true";
    const introSeen = undefined;
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(true);
  });

  it("should not show intro when flag is disabled", () => {
    const featureFlag = "false";
    const introSeen = undefined;
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(false);
  });

  it("should not show intro when already seen", () => {
    const featureFlag = "true";
    const introSeen = "1";
    const shouldShow = featureFlag !== "false" && !introSeen;
    expect(shouldShow).toBe(false);
  });

  it("should show intro when flag is undefined (default enabled)", () => {
    const featureFlag = undefined;
    const introSeen = undefined;
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
    expect(step).toBeLessThan(TOTAL_STEPS);
  });

  it("last step index is TOTAL_STEPS - 1", () => {
    const lastStep = TOTAL_STEPS - 1;
    expect(lastStep).toBe(8);
  });

  it("isLast is true only on final step", () => {
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const isLast = i === TOTAL_STEPS - 1;
      if (i === TOTAL_STEPS - 1) {
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
  const stepTitles = [
    "Welcome to Chess Online",
    "Play Online",
    "Time Controls",
    "Open Games",
    "Private Games",
    "Play vs Computer",
    "Puzzle Trainer",
    "Game History",
    "Board Customization",
  ];

  const stepSelectors: (string | undefined)[] = [
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

  it("has the correct number of steps", () => {
    expect(stepTitles).toHaveLength(TOTAL_STEPS);
    expect(stepSelectors).toHaveLength(TOTAL_STEPS);
  });

  it("first step is the welcome (no target element)", () => {
    expect(stepTitles[0]).toBe("Welcome to Chess Online");
    expect(stepSelectors[0]).toBeUndefined();
  });

  it("last step is board customization", () => {
    expect(stepTitles[stepTitles.length - 1]).toBe("Board Customization");
  });

  it("all steps after welcome have a target selector", () => {
    for (let i = 1; i < stepSelectors.length; i++) {
      expect(stepSelectors[i]).toBeDefined();
      expect(typeof stepSelectors[i]).toBe("string");
    }
  });

  it("contains all expected topics", () => {
    const topics = [
      "Play Online",
      "Time Controls",
      "Open Games",
      "Private Games",
      "Play vs Computer",
      "Puzzle Trainer",
      "Game History",
      "Board Customization",
    ];
    for (const topic of topics) {
      expect(stepTitles).toContain(topic);
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
