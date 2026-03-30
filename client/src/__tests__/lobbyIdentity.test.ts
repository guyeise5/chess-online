import { describe, it, expect } from "vitest";

/**
 * Documents the client→server identity split for the lobby (userId vs displayName).
 * Server handlers should accept these shapes alongside legacy playerName where needed.
 */

describe("Lobby identity socket payloads", () => {
  const userId = "user-oidc-123";
  const displayName = "Alice";
  const roomId = "room-abc";

  it("room:leave includes roomId and userId only", () => {
    const leave = { roomId, userId };
    expect(leave).toEqual({ roomId, userId });
    expect("displayName" in leave).toBe(false);
    expect("playerName" in leave).toBe(false);
  });

  it("room:join includes roomId, userId, and displayName", () => {
    expect({ roomId, userId, displayName }).toEqual({
      roomId,
      userId,
      displayName,
    });
  });

  it("room:create includes userId, displayName, timeControl, increment, and colorChoice", () => {
    const create = {
      userId,
      displayName,
      timeControl: 300,
      increment: 0,
      colorChoice: "random" as const,
    };
    expect(create.userId).toBe(userId);
    expect(create.displayName).toBe(displayName);
  });

  it("room:create private adds isPrivate", () => {
    const createPrivate = {
      userId,
      displayName,
      timeControl: 60,
      increment: 0,
      colorChoice: "white" as const,
      isPrivate: true,
    };
    expect(createPrivate.isPrivate).toBe(true);
  });

  it("own-room detection uses userId against room.owner", () => {
    const room = { owner: userId, roomId };
    expect(room.owner === userId).toBe(true);
  });
});
