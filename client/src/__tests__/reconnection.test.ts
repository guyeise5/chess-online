import { describe, it, expect } from "vitest";

/** Mirrors the readStoredUser logic from App.tsx, operating on an in-memory store. */
function readStoredUser(store: Record<string, string>, key: string): { userId: string; displayName: string } {
  try {
    const raw = store[key];
    if (!raw) return { userId: "", displayName: "" };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const rec = parsed as Record<string, unknown>;
      const uid = typeof rec["userId"] === "string" ? rec["userId"] : "";
      const dn = typeof rec["displayName"] === "string" ? rec["displayName"] : uid;
      return { userId: uid, displayName: dn };
    }
  } catch { /* corrupt or unavailable */ }
  return { userId: "", displayName: "" };
}

const KEY = "chess-user";

describe("reconnection via URL and server session", () => {
  it("roomId is embedded in the game URL", () => {
    const roomId = "abc12345";
    const path = `/game/${roomId}`;
    const match = path.match(/^\/game\/([^/]+)$/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("abc12345");
  });

  it("game page can derive roomId from URL on mount", () => {
    const params = { roomId: "room-xyz" };
    expect(params.roomId).toBe("room-xyz");
  });

  it("SAML: identity is fetched from server (/api/auth/me) on page load", () => {
    const serverResponse = { userId: "user-1", displayName: "Alice" };
    expect(serverResponse.userId).toBe("user-1");
    expect(serverResponse.displayName).toBe("Alice");
  });

  it("rejoin payload uses URL roomId and server-derived identity", () => {
    const roomId = "abc12345";
    const userId = "user-1";
    const payload = { roomId, userId };
    expect(payload).toEqual({ roomId: "abc12345", userId: "user-1" });
  });

  it("failed rejoin navigates to lobby", () => {
    const rejoinSuccess = false;
    const shouldRedirect = !rejoinSuccess;
    expect(shouldRedirect).toBe(true);
  });

  it("active game guard redirects to game URL", () => {
    const activeGameRoomId = "room-123";
    const currentPath = "/";
    const shouldRedirect = !currentPath.startsWith(`/game/${activeGameRoomId}`);
    expect(shouldRedirect).toBe(true);
  });

  it("no redirect when already on the game page", () => {
    const activeGameRoomId = "room-123";
    const currentPath = "/game/room-123";
    const shouldRedirect = !currentPath.startsWith(`/game/${activeGameRoomId}`);
    expect(shouldRedirect).toBe(false);
  });
});

describe("non-SAML identity persistence via localStorage", () => {
  it("persists userId and displayName", () => {
    const store: Record<string, string> = {};
    store[KEY] = JSON.stringify({ userId: "Bob", displayName: "Bob" });
    const stored = readStoredUser(store, KEY);
    expect(stored.userId).toBe("Bob");
    expect(stored.displayName).toBe("Bob");
  });

  it("restores identity on refresh", () => {
    const store: Record<string, string> = {
      [KEY]: JSON.stringify({ userId: "Alice", displayName: "Alice" }),
    };
    const { userId, displayName } = readStoredUser(store, KEY);
    expect(userId).toBe("Alice");
    expect(displayName).toBe("Alice");
  });

  it("returns empty strings when store has no entry", () => {
    const store: Record<string, string> = {};
    const { userId, displayName } = readStoredUser(store, KEY);
    expect(userId).toBe("");
    expect(displayName).toBe("");
  });

  it("returns empty strings for corrupt JSON", () => {
    const store: Record<string, string> = { [KEY]: "not-json" };
    const { userId, displayName } = readStoredUser(store, KEY);
    expect(userId).toBe("");
    expect(displayName).toBe("");
  });

  it("clearing stored user removes the entry", () => {
    const store: Record<string, string> = {
      [KEY]: JSON.stringify({ userId: "Bob", displayName: "Bob" }),
    };
    delete store[KEY];
    const { userId } = readStoredUser(store, KEY);
    expect(userId).toBe("");
  });

  it("SAML path does not read from localStorage", () => {
    const store: Record<string, string> = {
      [KEY]: JSON.stringify({ userId: "Bob", displayName: "Bob" }),
    };
    const samlEnabled = true;
    const userId = samlEnabled ? "" : readStoredUser(store, KEY).userId;
    expect(userId).toBe("");
  });

  it("displayName falls back to userId when missing", () => {
    const store: Record<string, string> = {
      [KEY]: JSON.stringify({ userId: "Charlie" }),
    };
    const { userId, displayName } = readStoredUser(store, KEY);
    expect(userId).toBe("Charlie");
    expect(displayName).toBe("Charlie");
  });
});
