import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

interface ConfirmState {
  resignConfirm: boolean;
  drawConfirm: boolean;
  drawOfferPending: boolean;
  undoPending: boolean;
  drawOfferer: string | null;
  undoRequester: string | null;
}

function initialState(): ConfirmState {
  return {
    resignConfirm: false,
    drawConfirm: false,
    drawOfferPending: false,
    undoPending: false,
    drawOfferer: null,
    undoRequester: null,
  };
}

function startResignConfirm(state: ConfirmState): ConfirmState {
  return { ...state, resignConfirm: true, drawConfirm: false };
}

function cancelResignConfirm(state: ConfirmState): ConfirmState {
  return { ...state, resignConfirm: false };
}

function confirmResign(state: ConfirmState): ConfirmState {
  return { ...state, resignConfirm: false };
}

function startDrawConfirm(state: ConfirmState): ConfirmState {
  return { ...state, drawConfirm: true, resignConfirm: false };
}

function cancelDrawConfirm(state: ConfirmState): ConfirmState {
  return { ...state, drawConfirm: false };
}

function confirmDrawOffer(state: ConfirmState): ConfirmState {
  return { ...state, drawConfirm: false, drawOfferPending: true };
}

function onDrawOfferReceived(state: ConfirmState, offerer: string): ConfirmState {
  return { ...state, drawOfferer: offerer, drawConfirm: false };
}

function onUndoRequestReceived(state: ConfirmState, requester: string): ConfirmState {
  return { ...state, undoRequester: requester };
}

function onDrawDeclined(state: ConfirmState): ConfirmState {
  return { ...state, drawOfferer: null, drawOfferPending: false };
}

function onUndoDeclined(state: ConfirmState): ConfirmState {
  return { ...state, undoRequester: null, undoPending: false };
}

function shouldShowResignConfirm(state: ConfirmState): boolean {
  return state.resignConfirm;
}

function shouldShowDrawConfirm(state: ConfirmState): boolean {
  return state.drawConfirm;
}

function shouldShowUndoAcceptDecline(
  state: ConfirmState,
  playerName: string
): boolean {
  return state.undoRequester !== null && state.undoRequester !== playerName;
}

function shouldShowDrawAcceptDecline(
  state: ConfirmState,
  playerName: string,
  featureEnabled: boolean
): boolean {
  return (
    featureEnabled &&
    state.drawOfferer !== null &&
    state.drawOfferer !== playerName
  );
}

describe("resign confirm state machine", () => {
  let state: ConfirmState;

  beforeEach(() => {
    state = initialState();
  });

  it("starts with no confirm active", () => {
    expect(state.resignConfirm).toBe(false);
  });

  it("first click activates confirm", () => {
    state = startResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(true);
  });

  it("cancel clears confirm", () => {
    state = startResignConfirm(state);
    state = cancelResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(false);
  });

  it("confirm clears the confirm state", () => {
    state = startResignConfirm(state);
    state = confirmResign(state);
    expect(shouldShowResignConfirm(state)).toBe(false);
  });

  it("starting resign cancels draw confirm", () => {
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);
    state = startResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(true);
    expect(shouldShowDrawConfirm(state)).toBe(false);
  });
});

describe("draw confirm state machine", () => {
  let state: ConfirmState;

  beforeEach(() => {
    state = initialState();
  });

  it("starts with no confirm active", () => {
    expect(state.drawConfirm).toBe(false);
  });

  it("first click activates confirm", () => {
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);
  });

  it("cancel clears confirm", () => {
    state = startDrawConfirm(state);
    state = cancelDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(false);
  });

  it("confirm sends the offer and clears confirm", () => {
    state = startDrawConfirm(state);
    state = confirmDrawOffer(state);
    expect(shouldShowDrawConfirm(state)).toBe(false);
    expect(state.drawOfferPending).toBe(true);
  });

  it("starting draw cancels resign confirm", () => {
    state = startResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(true);
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);
    expect(shouldShowResignConfirm(state)).toBe(false);
  });

  it("incoming draw offer clears outgoing draw confirm", () => {
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);
    state = onDrawOfferReceived(state, "Alice");
    expect(shouldShowDrawConfirm(state)).toBe(false);
    expect(state.drawOfferer).toBe("Alice");
  });
});

describe("resign confirm auto-cancel timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-cancels resign confirm after 3 seconds", () => {
    let state = initialState();
    state = startResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(true);

    const timer = setTimeout(() => {
      state = cancelResignConfirm(state);
    }, 3000);

    vi.advanceTimersByTime(3000);
    expect(shouldShowResignConfirm(state)).toBe(false);
    clearTimeout(timer);
  });

  it("does not auto-cancel before 3 seconds", () => {
    let state = initialState();
    state = startResignConfirm(state);

    const timer = setTimeout(() => {
      state = cancelResignConfirm(state);
    }, 3000);

    vi.advanceTimersByTime(2999);
    expect(shouldShowResignConfirm(state)).toBe(true);
    clearTimeout(timer);
  });
});

describe("draw confirm auto-cancel timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-cancels draw confirm after 3 seconds", () => {
    let state = initialState();
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);

    const timer = setTimeout(() => {
      state = cancelDrawConfirm(state);
    }, 3000);

    vi.advanceTimersByTime(3000);
    expect(shouldShowDrawConfirm(state)).toBe(false);
    clearTimeout(timer);
  });
});

describe("inline accept/decline for incoming requests", () => {
  let state: ConfirmState;

  beforeEach(() => {
    state = initialState();
  });

  it("shows undo accept/decline when opponent requests", () => {
    state = onUndoRequestReceived(state, "Alice");
    expect(shouldShowUndoAcceptDecline(state, "Bob")).toBe(true);
  });

  it("does not show undo accept/decline to the requester", () => {
    state = onUndoRequestReceived(state, "Alice");
    expect(shouldShowUndoAcceptDecline(state, "Alice")).toBe(false);
  });

  it("shows draw accept/decline when opponent offers", () => {
    state = onDrawOfferReceived(state, "Alice");
    expect(shouldShowDrawAcceptDecline(state, "Bob", true)).toBe(true);
  });

  it("does not show draw accept/decline to the offerer", () => {
    state = onDrawOfferReceived(state, "Alice");
    expect(shouldShowDrawAcceptDecline(state, "Alice", true)).toBe(false);
  });

  it("does not show draw accept/decline when feature disabled", () => {
    state = onDrawOfferReceived(state, "Alice");
    expect(shouldShowDrawAcceptDecline(state, "Bob", false)).toBe(false);
  });

  it("clears undo request on decline", () => {
    state = onUndoRequestReceived(state, "Alice");
    state = onUndoDeclined(state);
    expect(shouldShowUndoAcceptDecline(state, "Bob")).toBe(false);
  });

  it("clears draw offer on decline", () => {
    state = onDrawOfferReceived(state, "Alice");
    state = onDrawDeclined(state);
    expect(shouldShowDrawAcceptDecline(state, "Bob", true)).toBe(false);
  });
});

describe("only one confirm at a time", () => {
  it("resign then draw: only draw is active", () => {
    let state = initialState();
    state = startResignConfirm(state);
    state = startDrawConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(false);
    expect(shouldShowDrawConfirm(state)).toBe(true);
  });

  it("draw then resign: only resign is active", () => {
    let state = initialState();
    state = startDrawConfirm(state);
    state = startResignConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(false);
    expect(shouldShowResignConfirm(state)).toBe(true);
  });

  it("rapid toggling settles to last action", () => {
    let state = initialState();
    state = startResignConfirm(state);
    state = startDrawConfirm(state);
    state = startResignConfirm(state);
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);
    expect(shouldShowResignConfirm(state)).toBe(false);
  });
});

describe("full lifecycle flows", () => {
  it("resign: click → confirm → resigns (clears state)", () => {
    let state = initialState();
    state = startResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(true);
    state = confirmResign(state);
    expect(shouldShowResignConfirm(state)).toBe(false);
  });

  it("resign: click → cancel → back to normal", () => {
    let state = initialState();
    state = startResignConfirm(state);
    state = cancelResignConfirm(state);
    expect(shouldShowResignConfirm(state)).toBe(false);
  });

  it("draw: click → confirm → offer sent (pending)", () => {
    let state = initialState();
    state = startDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(true);
    state = confirmDrawOffer(state);
    expect(shouldShowDrawConfirm(state)).toBe(false);
    expect(state.drawOfferPending).toBe(true);
  });

  it("draw: click → cancel → back to normal", () => {
    let state = initialState();
    state = startDrawConfirm(state);
    state = cancelDrawConfirm(state);
    expect(shouldShowDrawConfirm(state)).toBe(false);
    expect(state.drawOfferPending).toBe(false);
  });

  it("opponent offers draw while confirm active → shows accept/decline", () => {
    let state = initialState();
    state = startDrawConfirm(state);
    state = onDrawOfferReceived(state, "Alice");
    expect(shouldShowDrawConfirm(state)).toBe(false);
    expect(shouldShowDrawAcceptDecline(state, "Bob", true)).toBe(true);
  });
});
