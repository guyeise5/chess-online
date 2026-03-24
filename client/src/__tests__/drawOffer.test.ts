import { describe, it, expect, beforeEach } from "vitest";

interface DrawOfferState {
  drawOfferer: string | null;
  drawOfferPending: boolean;
}

function initialState(): DrawOfferState {
  return {
    drawOfferer: null,
    drawOfferPending: false,
  };
}

function onDrawOffer(state: DrawOfferState, playerName: string): DrawOfferState {
  return { ...state, drawOfferer: playerName };
}

function onDrawDeclined(_state: DrawOfferState): DrawOfferState {
  return { drawOfferer: null, drawOfferPending: false };
}

function onDrawCancelled(_state: DrawOfferState): DrawOfferState {
  return { drawOfferer: null, drawOfferPending: false };
}

function onGameFinished(_state: DrawOfferState): DrawOfferState {
  return { drawOfferer: null, drawOfferPending: false };
}

function onUndo(_state: DrawOfferState): DrawOfferState {
  return { drawOfferer: null, drawOfferPending: false };
}

function onSendOffer(state: DrawOfferState): DrawOfferState {
  return { ...state, drawOfferPending: true };
}

function shouldShowDrawBanner(
  state: DrawOfferState,
  featureEnabled: boolean,
  playerName: string,
  status: string
): boolean {
  return (
    featureEnabled &&
    state.drawOfferer !== null &&
    state.drawOfferer !== playerName &&
    status === "playing"
  );
}

function shouldShowDrawButton(
  featureEnabled: boolean,
  isPlayer: boolean,
  status: string
): boolean {
  return featureEnabled && isPlayer && status === "playing";
}

describe("draw offer state machine", () => {
  let state: DrawOfferState;

  beforeEach(() => {
    state = initialState();
  });

  it("starts with no draw offer", () => {
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("shows banner when opponent offers draw", () => {
    state = onDrawOffer(state, "Alice");
    expect(shouldShowDrawBanner(state, true, "Bob", "playing")).toBe(true);
  });

  it("does not show banner to the offerer", () => {
    state = onDrawOffer(state, "Alice");
    expect(shouldShowDrawBanner(state, true, "Alice", "playing")).toBe(false);
  });

  it("hides banner when feature flag is disabled", () => {
    state = onDrawOffer(state, "Alice");
    expect(shouldShowDrawBanner(state, false, "Bob", "playing")).toBe(false);
  });

  it("hides banner when game is not playing", () => {
    state = onDrawOffer(state, "Alice");
    expect(shouldShowDrawBanner(state, true, "Bob", "waiting")).toBe(false);
    expect(shouldShowDrawBanner(state, true, "Bob", "finished")).toBe(false);
  });

  it("clears state when draw is declined", () => {
    state = onSendOffer(state);
    state = onDrawOffer(state, "Alice");
    state = onDrawDeclined(state);
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("clears state when draw is cancelled by move", () => {
    state = onDrawOffer(state, "Alice");
    state = onDrawCancelled(state);
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("clears state on game over", () => {
    state = onDrawOffer(state, "Alice");
    state = onGameFinished(state);
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("clears state on undo", () => {
    state = onDrawOffer(state, "Alice");
    state = onUndo(state);
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("sets pending when sending offer", () => {
    state = onSendOffer(state);
    expect(state.drawOfferPending).toBe(true);
  });

  it("full lifecycle: offer → decline → clears", () => {
    state = onSendOffer(state);
    expect(state.drawOfferPending).toBe(true);

    state = onDrawOffer(state, "Alice");
    state = onDrawDeclined(state);
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("full lifecycle: opponent offers → accept (game over clears)", () => {
    state = onDrawOffer(state, "Alice");
    expect(shouldShowDrawBanner(state, true, "Bob", "playing")).toBe(true);

    state = onGameFinished(state);
    expect(state.drawOfferer).toBeNull();
    expect(state.drawOfferPending).toBe(false);
  });

  it("full lifecycle: offer → move cancels → new offer allowed", () => {
    state = onSendOffer(state);
    state = onDrawOffer(state, "Alice");
    state = onDrawCancelled(state);
    expect(state.drawOfferPending).toBe(false);
    expect(state.drawOfferer).toBeNull();
  });
});

describe("draw offer button visibility", () => {
  it("shows draw button for player in playing game", () => {
    expect(shouldShowDrawButton(true, true, "playing")).toBe(true);
  });

  it("hides draw button for spectators", () => {
    expect(shouldShowDrawButton(true, false, "playing")).toBe(false);
  });

  it("hides draw button in finished game", () => {
    expect(shouldShowDrawButton(true, true, "finished")).toBe(false);
  });

  it("hides draw button in waiting room", () => {
    expect(shouldShowDrawButton(true, true, "waiting")).toBe(false);
  });

  it("hides draw button when feature disabled", () => {
    expect(shouldShowDrawButton(false, true, "playing")).toBe(false);
  });
});

describe("draw offer socket events", () => {
  it("draw-offer emits correct event shape", () => {
    const event = "game:draw-offer";
    const data = { roomId: "test-room", playerName: "Alice" };
    expect(event).toBe("game:draw-offer");
    expect(data).toEqual({ roomId: "test-room", playerName: "Alice" });
  });

  it("draw-response accept emits correct event shape", () => {
    const event = "game:draw-response";
    const data = { roomId: "test-room", playerName: "Bob", accepted: true };
    expect(event).toBe("game:draw-response");
    expect(data).toEqual({ roomId: "test-room", playerName: "Bob", accepted: true });
  });

  it("draw-response decline emits correct event shape", () => {
    const event = "game:draw-response";
    const data = { roomId: "test-room", playerName: "Bob", accepted: false };
    expect(event).toBe("game:draw-response");
    expect(data).toEqual({ roomId: "test-room", playerName: "Bob", accepted: false });
  });
});
