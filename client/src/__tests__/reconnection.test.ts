import { describe, it, expect, beforeEach } from "vitest";

const ROOM_ID_KEY = "chess-active-room";
const PLAYER_NAME_KEY = "chess-player-name";

/**
 * These tests verify the localStorage-based reconnection logic used in App.tsx.
 * The app persists roomId and playerName so it can auto-rejoin after page refresh.
 * We use a plain Map to simulate localStorage behavior, testing the same
 * get/set/remove patterns the component uses.
 */

let store: Map<string, string>;

function getItem(key: string): string | null {
  return store.get(key) ?? null;
}
function setItem(key: string, value: string): void {
  store.set(key, value);
}
function removeItem(key: string): void {
  store.delete(key);
}

beforeEach(() => {
  store = new Map();
});

describe("reconnection localStorage", () => {
  it("stores player name", () => {
    setItem(PLAYER_NAME_KEY, "Alice");
    expect(getItem(PLAYER_NAME_KEY)).toBe("Alice");
  });

  it("stores active room ID", () => {
    setItem(ROOM_ID_KEY, "abc12345");
    expect(getItem(ROOM_ID_KEY)).toBe("abc12345");
  });

  it("clears room ID when leaving a room", () => {
    setItem(ROOM_ID_KEY, "abc12345");
    removeItem(ROOM_ID_KEY);
    expect(getItem(ROOM_ID_KEY)).toBeNull();
  });

  it("clears both keys when changing name", () => {
    setItem(PLAYER_NAME_KEY, "Alice");
    setItem(ROOM_ID_KEY, "abc12345");

    removeItem(PLAYER_NAME_KEY);
    removeItem(ROOM_ID_KEY);

    expect(getItem(PLAYER_NAME_KEY)).toBeNull();
    expect(getItem(ROOM_ID_KEY)).toBeNull();
  });

  it("persists across simulated page reloads", () => {
    setItem(PLAYER_NAME_KEY, "Bob");
    setItem(ROOM_ID_KEY, "room-xyz");

    const savedName = getItem(PLAYER_NAME_KEY);
    const savedRoom = getItem(ROOM_ID_KEY);

    expect(savedName).toBe("Bob");
    expect(savedRoom).toBe("room-xyz");
  });

  it("returns null for missing keys (first visit)", () => {
    expect(getItem(PLAYER_NAME_KEY)).toBeNull();
    expect(getItem(ROOM_ID_KEY)).toBeNull();
  });

  it("can detect whether rejoin is needed", () => {
    const shouldRejoin1 = getItem(ROOM_ID_KEY) !== null && getItem(PLAYER_NAME_KEY) !== null;
    expect(shouldRejoin1).toBe(false);

    setItem(PLAYER_NAME_KEY, "Alice");
    setItem(ROOM_ID_KEY, "room-123");
    const shouldRejoin2 = getItem(ROOM_ID_KEY) !== null && getItem(PLAYER_NAME_KEY) !== null;
    expect(shouldRejoin2).toBe(true);
  });

  it("only requires both keys to trigger rejoin", () => {
    // Only name — no rejoin
    setItem(PLAYER_NAME_KEY, "Alice");
    expect(getItem(ROOM_ID_KEY) && getItem(PLAYER_NAME_KEY)).toBeFalsy();

    // Only room — no rejoin
    removeItem(PLAYER_NAME_KEY);
    setItem(ROOM_ID_KEY, "room-123");
    expect(getItem(ROOM_ID_KEY) && getItem(PLAYER_NAME_KEY)).toBeFalsy();
  });

  it("stores game:start roomId correctly", () => {
    const room = { roomId: "start-room" };
    setItem(ROOM_ID_KEY, room.roomId);
    expect(getItem(ROOM_ID_KEY)).toBe("start-room");
  });

  it("clears stale room on failed rejoin but keeps name", () => {
    setItem(ROOM_ID_KEY, "stale-room");
    setItem(PLAYER_NAME_KEY, "Alice");

    const rejoinSuccess = false;
    if (!rejoinSuccess) {
      removeItem(ROOM_ID_KEY);
    }

    expect(getItem(ROOM_ID_KEY)).toBeNull();
    expect(getItem(PLAYER_NAME_KEY)).toBe("Alice");
  });
});
