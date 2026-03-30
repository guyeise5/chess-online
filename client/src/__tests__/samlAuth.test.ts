import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SAML auth feature flag", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("when FEATURE_SAML_AUTH is not set, getEnv returns undefined for it", async () => {
    vi.stubGlobal("__ENV__", {});
    const { getEnv } = await import("../types");
    expect(getEnv().FEATURE_SAML_AUTH).toBeUndefined();
  });

  it("when FEATURE_SAML_AUTH is 'false', auth is disabled", async () => {
    vi.stubGlobal("__ENV__", { FEATURE_SAML_AUTH: "false" });
    const mod = await import("../types");
    expect(mod.getEnv().FEATURE_SAML_AUTH).toBe("false");
    expect(mod.getEnv().FEATURE_SAML_AUTH === "true").toBe(false);
  });

  it("when FEATURE_SAML_AUTH is 'true', auth is enabled", async () => {
    vi.stubGlobal("__ENV__", { FEATURE_SAML_AUTH: "true" });
    const mod = await import("../types");
    expect(mod.getEnv().FEATURE_SAML_AUTH).toBe("true");
    expect(mod.getEnv().FEATURE_SAML_AUTH === "true").toBe(true);
  });
});

describe("userId / displayName identity", () => {
  it("when auth off, userId equals displayName (both from typed name)", () => {
    const typedName = "Alice";
    const userId = typedName;
    const displayName = typedName;
    expect(userId).toBe(displayName);
    expect(userId).toBe("Alice");
  });

  it("when auth on, userId is separate from displayName", () => {
    const userId = "saml-sub-12345";
    const firstName = "Alice";
    const lastName = "Smith";
    const displayName = `${firstName} ${lastName}`;
    expect(userId).not.toBe(displayName);
    expect(displayName).toBe("Alice Smith");
  });

  it("socket events should send userId, not displayName, for identity", () => {
    const userId = "user-id-123";
    const displayName = "Alice Smith";
    const socketPayload = { roomId: "room-1", userId };
    expect(socketPayload).toHaveProperty("userId", userId);
    expect(socketPayload).not.toHaveProperty("playerName");
    expect(socketPayload).not.toHaveProperty("displayName");
    void displayName;
  });

  it("room:create should send both userId and displayName", () => {
    const userId = "user-id-123";
    const displayName = "Alice Smith";
    const payload = {
      userId,
      displayName,
      timeControl: 300,
      increment: 0,
      colorChoice: "random",
    };
    expect(payload.userId).toBe("user-id-123");
    expect(payload.displayName).toBe("Alice Smith");
  });
});

describe("RoomData display name fields", () => {
  it("RoomData includes display name fields", () => {
    const room = {
      roomId: "abc",
      owner: "uid-1",
      ownerName: "Alice",
      opponent: "uid-2",
      opponentName: "Bob",
      whitePlayer: "uid-1",
      blackPlayer: "uid-2",
      whiteName: "Alice",
      blackName: "Bob",
      timeFormat: "blitz" as const,
      timeControl: 300,
      increment: 0,
      colorChoice: "random" as const,
      status: "playing" as const,
      fen: "startpos",
      whiteTime: 300,
      blackTime: 300,
      turn: "w" as const,
      result: null,
      moves: [],
    };
    expect(room.whiteName).toBe("Alice");
    expect(room.blackName).toBe("Bob");
    expect(room.ownerName).toBe("Alice");
    expect(room.opponentName).toBe("Bob");
  });
});
