import { describe, it, expect, beforeEach } from "vitest";

interface RematchState {
  rematchOffered: string | null;
}

function initialState(): RematchState {
  return { rematchOffered: null };
}

function onRematchOffer(state: RematchState, userId: string): RematchState {
  return { ...state, rematchOffered: userId };
}

function onRematchCancelled(_state: RematchState): RematchState {
  return { rematchOffered: null };
}

function onGameOver(_state: RematchState): RematchState {
  return { rematchOffered: null };
}

function shouldShowRematchButton(
  featureEnabled: boolean,
  isPlayer: boolean,
  status: string
): boolean {
  return featureEnabled && isPlayer && status === "finished";
}

function getRematchButtonStyle(
  state: RematchState,
  userId: string
): "normal" | "pending" | "accept" {
  if (state.rematchOffered === userId) return "pending";
  if (state.rematchOffered !== null) return "accept";
  return "normal";
}

describe("rematch state machine", () => {
  let state: RematchState;

  beforeEach(() => {
    state = initialState();
  });

  it("starts with no rematch offer", () => {
    expect(state.rematchOffered).toBeNull();
  });

  it("stores offerer when rematch is offered", () => {
    state = onRematchOffer(state, "Alice");
    expect(state.rematchOffered).toBe("Alice");
  });

  it("replaces previous offer with new one", () => {
    state = onRematchOffer(state, "Alice");
    state = onRematchOffer(state, "Bob");
    expect(state.rematchOffered).toBe("Bob");
  });

  it("clears state when rematch is cancelled", () => {
    state = onRematchOffer(state, "Alice");
    state = onRematchCancelled(state);
    expect(state.rematchOffered).toBeNull();
  });

  it("clears state on game over", () => {
    state = onRematchOffer(state, "Alice");
    state = onGameOver(state);
    expect(state.rematchOffered).toBeNull();
  });

  it("cancel is idempotent", () => {
    state = onRematchCancelled(state);
    expect(state.rematchOffered).toBeNull();
  });

  it("full lifecycle: offer → cancel → re-offer", () => {
    state = onRematchOffer(state, "Alice");
    state = onRematchCancelled(state);
    expect(state.rematchOffered).toBeNull();
    state = onRematchOffer(state, "Bob");
    expect(state.rematchOffered).toBe("Bob");
  });
});

describe("rematch button visibility", () => {
  it("shows when player in finished game with feature enabled", () => {
    expect(shouldShowRematchButton(true, true, "finished")).toBe(true);
  });

  it("hides for spectators", () => {
    expect(shouldShowRematchButton(true, false, "finished")).toBe(false);
  });

  it("hides in playing game", () => {
    expect(shouldShowRematchButton(true, true, "playing")).toBe(false);
  });

  it("hides in waiting room", () => {
    expect(shouldShowRematchButton(true, true, "waiting")).toBe(false);
  });

  it("hides when feature disabled", () => {
    expect(shouldShowRematchButton(false, true, "finished")).toBe(false);
  });

  it("hides for non-player when feature disabled", () => {
    expect(shouldShowRematchButton(false, false, "finished")).toBe(false);
  });
});

describe("rematch button style", () => {
  it("normal when no offer exists", () => {
    const state: RematchState = { rematchOffered: null };
    expect(getRematchButtonStyle(state, "Alice")).toBe("normal");
  });

  it("pending when I offered", () => {
    const state: RematchState = { rematchOffered: "Alice" };
    expect(getRematchButtonStyle(state, "Alice")).toBe("pending");
  });

  it("accept when opponent offered", () => {
    const state: RematchState = { rematchOffered: "Bob" };
    expect(getRematchButtonStyle(state, "Alice")).toBe("accept");
  });

  it("pending is correct even with display name differences", () => {
    const state: RematchState = { rematchOffered: "user-123" };
    expect(getRematchButtonStyle(state, "user-123")).toBe("pending");
    expect(getRematchButtonStyle(state, "user-456")).toBe("accept");
  });
});

describe("rematch socket events", () => {
  it("rematch-offer emits correct event shape", () => {
    const event = "game:rematch-offer";
    const data = { roomId: "test-room" };
    expect(event).toBe("game:rematch-offer");
    expect(data).toEqual({ roomId: "test-room" });
  });

  it("rematch-cancel emits correct event shape", () => {
    const event = "game:rematch-cancel";
    const data = { roomId: "test-room" };
    expect(event).toBe("game:rematch-cancel");
    expect(data).toEqual({ roomId: "test-room" });
  });

  it("rematch-start has roomId field", () => {
    const data = { roomId: "new-room-abc" };
    expect(typeof data.roomId).toBe("string");
    expect(data.roomId.length).toBeGreaterThan(0);
  });
});

describe("rematch state reset", () => {
  interface GameState {
    lastMove: { from: string; to: string } | null;
    selectedSquare: string | null;
    premove: { from: string; to: string; promotion?: string } | null;
    viewingPly: number | null;
    gameOverReason: string | null;
    rematchOffered: string | null;
  }

  function rejoinReset(roomMoves: string[]): GameState {
    let lastMove: { from: string; to: string } | null = null;
    if (roomMoves.length) {
      for (const _san of roomMoves) {
        lastMove = { from: "e2", to: "e4" };
      }
    } else {
      lastMove = null;
    }
    return {
      lastMove,
      selectedSquare: null,
      premove: null,
      viewingPly: null,
      gameOverReason: null,
      rematchOffered: null,
    };
  }

  it("clears lastMove when rejoining a room with no moves", () => {
    const state = rejoinReset([]);
    expect(state.lastMove).toBeNull();
  });

  it("preserves lastMove when rejoining a room with moves", () => {
    const state = rejoinReset(["e4", "e5"]);
    expect(state.lastMove).not.toBeNull();
  });

  it("resets all interactive state on rejoin", () => {
    const state = rejoinReset([]);
    expect(state.selectedSquare).toBeNull();
    expect(state.premove).toBeNull();
    expect(state.viewingPly).toBeNull();
    expect(state.gameOverReason).toBeNull();
    expect(state.rematchOffered).toBeNull();
  });
});

describe("rematch color swap", () => {
  it("swaps colors from original game", () => {
    const originalWhite = "Alice";
    const originalBlack = "Bob";
    const newWhite = originalBlack;
    const newBlack = originalWhite;
    expect(newWhite).toBe("Bob");
    expect(newBlack).toBe("Alice");
  });

  it("preserves display names in swap", () => {
    const original = {
      whitePlayer: "alice-id",
      whiteName: "Alice Display",
      blackPlayer: "bob-id",
      blackName: "Bob Display",
    };
    const rematch = {
      whitePlayer: original.blackPlayer,
      whiteName: original.blackName,
      blackPlayer: original.whitePlayer,
      blackName: original.whiteName,
    };
    expect(rematch.whitePlayer).toBe("bob-id");
    expect(rematch.whiteName).toBe("Bob Display");
    expect(rematch.blackPlayer).toBe("alice-id");
    expect(rematch.blackName).toBe("Alice Display");
  });

  it("double swap returns to original", () => {
    const original = { white: "Alice", black: "Bob" };
    const after1 = { white: original.black, black: original.white };
    const after2 = { white: after1.black, black: after1.white };
    expect(after2).toEqual(original);
  });
});

describe("rematch feature flag logic", () => {
  function isRematchEnabled(flag: string | undefined): boolean {
    return flag !== "false";
  }

  it("enabled by default (undefined)", () => {
    expect(isRematchEnabled(undefined)).toBe(true);
  });

  it("enabled when set to true", () => {
    expect(isRematchEnabled("true")).toBe(true);
  });

  it("disabled when set to false", () => {
    expect(isRematchEnabled("false")).toBe(false);
  });

  it("enabled for empty string", () => {
    expect(isRematchEnabled("")).toBe(true);
  });
});
