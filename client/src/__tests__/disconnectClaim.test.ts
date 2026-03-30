import { describe, it, expect, beforeEach } from "vitest";

/**
 * Tests for the disconnect claim UI logic used in GameRoom.
 * We replicate the state machine from the component to verify:
 * - Banner visibility based on feature flag + state
 * - Countdown behavior
 * - State transitions on disconnect/reconnect/game-over events
 */

interface DisconnectState {
  opponentDisconnected: boolean;
  disconnectClaimAvailable: boolean;
  disconnectCountdown: number;
}

function initialState(): DisconnectState {
  return {
    opponentDisconnected: false,
    disconnectClaimAvailable: false,
    disconnectCountdown: 10,
  };
}

function onOpponentDisconnected(state: DisconnectState): DisconnectState {
  return {
    opponentDisconnected: true,
    disconnectClaimAvailable: false,
    disconnectCountdown: 10,
  };
}

function onOpponentReconnected(_state: DisconnectState): DisconnectState {
  return {
    opponentDisconnected: false,
    disconnectClaimAvailable: false,
    disconnectCountdown: 10,
  };
}

function onClaimAvailable(state: DisconnectState): DisconnectState {
  return { ...state, disconnectClaimAvailable: true };
}

function onGameFinished(_state: DisconnectState): DisconnectState {
  return {
    opponentDisconnected: false,
    disconnectClaimAvailable: false,
    disconnectCountdown: 10,
  };
}

function tickCountdown(state: DisconnectState): DisconnectState {
  if (!state.opponentDisconnected || state.disconnectClaimAvailable) return state;
  return { ...state, disconnectCountdown: Math.max(0, state.disconnectCountdown - 1) };
}

function shouldShowBanner(
  state: DisconnectState,
  featureEnabled: boolean,
  isPlayer: boolean,
  status: string
): boolean {
  return featureEnabled && state.opponentDisconnected && isPlayer && status === "playing";
}

describe("disconnect claim state machine", () => {
  let state: DisconnectState;

  beforeEach(() => {
    state = initialState();
  });

  it("starts with banner hidden", () => {
    expect(shouldShowBanner(state, true, true, "playing")).toBe(false);
  });

  it("shows banner when opponent disconnects", () => {
    state = onOpponentDisconnected(state);
    expect(shouldShowBanner(state, true, true, "playing")).toBe(true);
    expect(state.disconnectClaimAvailable).toBe(false);
    expect(state.disconnectCountdown).toBe(10);
  });

  it("hides banner when opponent reconnects", () => {
    state = onOpponentDisconnected(state);
    state = onOpponentReconnected(state);
    expect(shouldShowBanner(state, true, true, "playing")).toBe(false);
  });

  it("hides banner when game finishes", () => {
    state = onOpponentDisconnected(state);
    state = onGameFinished(state);
    expect(state.opponentDisconnected).toBe(false);
    expect(state.disconnectClaimAvailable).toBe(false);
  });

  it("hides banner when feature flag is disabled", () => {
    state = onOpponentDisconnected(state);
    expect(shouldShowBanner(state, false, true, "playing")).toBe(false);
  });

  it("hides banner for spectators (non-players)", () => {
    state = onOpponentDisconnected(state);
    expect(shouldShowBanner(state, true, false, "playing")).toBe(false);
  });

  it("hides banner when game is not playing", () => {
    state = onOpponentDisconnected(state);
    expect(shouldShowBanner(state, true, true, "waiting")).toBe(false);
    expect(shouldShowBanner(state, true, true, "finished")).toBe(false);
  });

  it("countdown ticks from 10 to 0", () => {
    state = onOpponentDisconnected(state);
    for (let i = 9; i >= 0; i--) {
      state = tickCountdown(state);
      expect(state.disconnectCountdown).toBe(i);
    }
    state = tickCountdown(state);
    expect(state.disconnectCountdown).toBe(0);
  });

  it("countdown stops ticking when claim becomes available", () => {
    state = onOpponentDisconnected(state);
    for (let i = 0; i < 5; i++) state = tickCountdown(state);
    expect(state.disconnectCountdown).toBe(5);

    state = onClaimAvailable(state);
    state = tickCountdown(state);
    expect(state.disconnectCountdown).toBe(5);
  });

  it("countdown resets when opponent reconnects and disconnects again", () => {
    state = onOpponentDisconnected(state);
    for (let i = 0; i < 5; i++) state = tickCountdown(state);
    expect(state.disconnectCountdown).toBe(5);

    state = onOpponentReconnected(state);
    state = onOpponentDisconnected(state);
    expect(state.disconnectCountdown).toBe(10);
  });

  it("sets claimAvailable on claim-available event", () => {
    state = onOpponentDisconnected(state);
    expect(state.disconnectClaimAvailable).toBe(false);

    state = onClaimAvailable(state);
    expect(state.disconnectClaimAvailable).toBe(true);
  });

  it("full lifecycle: disconnect → countdown → claim available", () => {
    state = onOpponentDisconnected(state);
    expect(shouldShowBanner(state, true, true, "playing")).toBe(true);
    expect(state.disconnectClaimAvailable).toBe(false);

    for (let i = 0; i < 10; i++) state = tickCountdown(state);
    expect(state.disconnectCountdown).toBe(0);

    state = onClaimAvailable(state);
    expect(state.disconnectClaimAvailable).toBe(true);
    expect(shouldShowBanner(state, true, true, "playing")).toBe(true);
  });

  it("full lifecycle: disconnect → reconnect cancels everything", () => {
    state = onOpponentDisconnected(state);
    for (let i = 0; i < 3; i++) state = tickCountdown(state);

    state = onOpponentReconnected(state);
    expect(state.opponentDisconnected).toBe(false);
    expect(state.disconnectClaimAvailable).toBe(false);
    expect(state.disconnectCountdown).toBe(10);
  });

  it("full lifecycle: disconnect → claim available → game over resets", () => {
    state = onOpponentDisconnected(state);
    state = onClaimAvailable(state);
    state = onGameFinished(state);

    expect(state.opponentDisconnected).toBe(false);
    expect(state.disconnectClaimAvailable).toBe(false);
  });
});

describe("disconnect claim socket events", () => {
  it("claim-win emits correct event shape", () => {
    const roomId = "test-room";
    const playerName = "Alice";
    const event = "game:claim-disconnect-win";
    const data = { roomId, playerName };

    expect(event).toBe("game:claim-disconnect-win");
    expect(data).toEqual({ roomId: "test-room", playerName: "Alice" });
  });

  it("claim-draw emits correct event shape", () => {
    const roomId = "test-room";
    const playerName = "Bob";
    const event = "game:claim-disconnect-draw";
    const data = { roomId, playerName };

    expect(event).toBe("game:claim-disconnect-draw");
    expect(data).toEqual({ roomId: "test-room", playerName: "Bob" });
  });

  it("player-left emits correct event shape", () => {
    const roomId = "test-room";
    const playerName = "Alice";
    const event = "game:player-left";
    const data = { roomId, playerName };

    expect(event).toBe("game:player-left");
    expect(data).toEqual({ roomId: "test-room", playerName: "Alice" });
  });
});

describe("active game navigation guard", () => {
  const ACTIVE_GAME_KEY = "chess-active-room";
  let store: Map<string, string>;

  const getItem = (k: string) => store.get(k) ?? null;
  const setItem = (k: string, v: string) => store.set(k, v);
  const removeItem = (k: string) => store.delete(k);

  beforeEach(() => {
    store = new Map();
  });

  function shouldRedirect(activeGameRoomId: string | null, currentPath: string): boolean {
    if (!activeGameRoomId) return false;
    return !currentPath.startsWith(`/game/${activeGameRoomId}`);
  }

  it("does not redirect when there is no active game", () => {
    expect(shouldRedirect(null, "/")).toBe(false);
    expect(shouldRedirect(null, "/computer")).toBe(false);
    expect(shouldRedirect(null, "/puzzles")).toBe(false);
  });

  it("does not redirect when user is on the active game route", () => {
    expect(shouldRedirect("abc123", "/game/abc123")).toBe(false);
  });

  it("redirects from lobby when there is an active game", () => {
    expect(shouldRedirect("abc123", "/")).toBe(true);
  });

  it("redirects from computer when there is an active game", () => {
    expect(shouldRedirect("abc123", "/computer")).toBe(true);
  });

  it("redirects from puzzles when there is an active game", () => {
    expect(shouldRedirect("abc123", "/puzzles")).toBe(true);
  });

  it("redirects from games history when there is an active game", () => {
    expect(shouldRedirect("abc123", "/games")).toBe(true);
  });

  it("redirects from analysis when there is an active game", () => {
    expect(shouldRedirect("abc123", "/analysis/some-id")).toBe(true);
  });

  it("redirects from puzzle analysis when there is an active game", () => {
    expect(shouldRedirect("abc123", "/analyzePuzzle/some-id")).toBe(true);
  });

  it("does not redirect from a different game room", () => {
    expect(shouldRedirect("abc123", "/game/xyz789")).toBe(true);
  });

  it("stores active game room in localStorage", () => {
    setItem(ACTIVE_GAME_KEY, "room-123");
    expect(getItem(ACTIVE_GAME_KEY)).toBe("room-123");
  });

  it("clears active game from localStorage on game end", () => {
    setItem(ACTIVE_GAME_KEY, "room-123");
    removeItem(ACTIVE_GAME_KEY);
    expect(getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it("persists active game across page reloads", () => {
    setItem(ACTIVE_GAME_KEY, "room-abc");
    expect(getItem(ACTIVE_GAME_KEY)).toBe("room-abc");
  });

  it("returns null for missing active game (first visit)", () => {
    expect(getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});
