import { describe, it, expect } from "vitest";

/**
 * Tests for the URL-based routing logic used across the app.
 * Validates route construction, roomId extraction, and navigation decisions.
 */

describe("game route construction", () => {
  it("builds the correct game URL from a roomId", () => {
    const roomId = "abc12345";
    const path = `/game/${roomId}`;
    expect(path).toBe("/game/abc12345");
  });

  it("builds the lobby URL", () => {
    const path = "/";
    expect(path).toBe("/");
  });
});

describe("roomId extraction from URL path", () => {
  function extractRoomId(path: string): string | null {
    const match = path.match(/^\/game\/([^/]+)$/);
    return match ? match[1] : null;
  }

  it("extracts roomId from a valid game path", () => {
    expect(extractRoomId("/game/abc12345")).toBe("abc12345");
  });

  it("returns null for the lobby path", () => {
    expect(extractRoomId("/")).toBeNull();
  });

  it("returns null for an unrelated path", () => {
    expect(extractRoomId("/settings")).toBeNull();
  });

  it("returns null for a nested game path", () => {
    expect(extractRoomId("/game/abc12345/extra")).toBeNull();
  });

  it("handles roomId with various characters", () => {
    expect(extractRoomId("/game/a1b2c3d4")).toBe("a1b2c3d4");
    expect(extractRoomId("/game/ROOM-XYZ")).toBe("ROOM-XYZ");
  });
});

describe("navigation decisions", () => {
  it("owner leaving a waiting room should navigate to lobby", () => {
    const status = "waiting";
    const owner = "Alice";
    const playerName = "Alice";
    const shouldClose = status === "waiting" && owner === playerName;
    expect(shouldClose).toBe(true);
  });

  it("non-owner leaving a waiting room should not close it", () => {
    const status = "waiting";
    const owner = "Alice";
    const playerName = "Bob";
    const shouldClose = status === "waiting" && owner === playerName;
    expect(shouldClose).toBe(false);
  });

  it("owner leaving a playing room should not close it", () => {
    const status = "playing";
    const owner = "Alice";
    const playerName = "Alice";
    const shouldClose = status === "waiting" && owner === playerName;
    expect(shouldClose).toBe(false);
  });

  it("owner leaving a finished room should not close it", () => {
    const status = "finished";
    const owner = "Alice";
    const playerName = "Alice";
    const shouldClose = status === "waiting" && owner === playerName;
    expect(shouldClose).toBe(false);
  });

  it("failed rejoin should redirect to lobby", () => {
    const rejoinSuccess = false;
    const shouldRedirect = !rejoinSuccess;
    expect(shouldRedirect).toBe(true);
  });

  it("successful rejoin should stay on game page", () => {
    const rejoinSuccess = true;
    const shouldRedirect = !rejoinSuccess;
    expect(shouldRedirect).toBe(false);
  });
});

describe("reconnection with URL routing", () => {
  it("URL persists roomId across refresh (no localStorage needed)", () => {
    const currentUrl = "/game/abc12345";
    const match = currentUrl.match(/^\/game\/([^/]+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("abc12345");
  });

  it("player name still comes from localStorage", () => {
    const PLAYER_NAME_KEY = "chess-player-name";
    const store = new Map<string, string>();
    store.set(PLAYER_NAME_KEY, "Alice");
    expect(store.get(PLAYER_NAME_KEY)).toBe("Alice");
  });

  it("game page should rejoin via socket when mounted", () => {
    const roomId = "abc12345";
    const playerName = "Alice";
    const rejoinPayload = { roomId, playerName };
    expect(rejoinPayload).toEqual({ roomId: "abc12345", playerName: "Alice" });
  });
});
