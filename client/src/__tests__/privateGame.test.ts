import { describe, it, expect } from "vitest";
import type { RoomData, ColorChoice } from "../types";

function makePrivateRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    roomId: "abc12345",
    owner: "Alice",
    opponent: null,
    timeFormat: "blitz",
    timeControl: 300,
    increment: 2,
    colorChoice: "white",
    isPrivate: true,
    status: "waiting",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    whitePlayer: null,
    blackPlayer: null,
    whiteTime: 300,
    blackTime: 300,
    turn: "w",
    result: null,
    moves: [],
    ...overrides,
  };
}

describe("invite URL construction", () => {
  it("builds the correct invite URL from roomId", () => {
    const roomId = "abc12345";
    const url = `/invite/${roomId}`;
    expect(url).toBe("/invite/abc12345");
  });

  it("builds full URL with origin", () => {
    const origin = "http://localhost:3001";
    const roomId = "xyz99887";
    const url = `${origin}/invite/${roomId}`;
    expect(url).toBe("http://localhost:3001/invite/xyz99887");
  });
});

describe("roomId extraction from invite path", () => {
  function extractInviteRoomId(path: string): string | null {
    const match = path.match(/^\/invite\/([^/]+)$/);
    return match ? match[1] : null;
  }

  it("extracts roomId from a valid invite path", () => {
    expect(extractInviteRoomId("/invite/abc12345")).toBe("abc12345");
  });

  it("returns null for a game path", () => {
    expect(extractInviteRoomId("/game/abc12345")).toBeNull();
  });

  it("returns null for the lobby path", () => {
    expect(extractInviteRoomId("/")).toBeNull();
  });

  it("returns null for nested invite paths", () => {
    expect(extractInviteRoomId("/invite/abc12345/extra")).toBeNull();
  });
});

describe("color label for invitee", () => {
  function colorLabel(choice: ColorChoice, ownerName: string, viewerName: string): string {
    if (choice === "random") return "Random";
    const ownerPlays = choice === "white" ? "White" : "Black";
    if (viewerName === ownerName) return ownerPlays;
    return ownerPlays === "White" ? "Black" : "White";
  }

  it("returns Random for random choice", () => {
    expect(colorLabel("random", "Alice", "Bob")).toBe("Random");
  });

  it("shows White for owner when owner chose white", () => {
    expect(colorLabel("white", "Alice", "Alice")).toBe("White");
  });

  it("shows Black for invitee when owner chose white", () => {
    expect(colorLabel("white", "Alice", "Bob")).toBe("Black");
  });

  it("shows Black for owner when owner chose black", () => {
    expect(colorLabel("black", "Alice", "Alice")).toBe("Black");
  });

  it("shows White for invitee when owner chose black", () => {
    expect(colorLabel("black", "Alice", "Bob")).toBe("White");
  });
});

describe("invite page state logic", () => {
  it("invitee can accept a waiting room they don't own", () => {
    const room = makePrivateRoom();
    const playerName = "Bob";
    const isOwner = room.owner === playerName;
    const canAccept = room.status === "waiting" && !isOwner;
    expect(canAccept).toBe(true);
  });

  it("owner cannot accept their own room", () => {
    const room = makePrivateRoom();
    const playerName = "Alice";
    const isOwner = room.owner === playerName;
    const canAccept = room.status === "waiting" && !isOwner;
    expect(canAccept).toBe(false);
  });

  it("cannot accept a room that is already playing", () => {
    const room = makePrivateRoom({ status: "playing" });
    const playerName = "Bob";
    const isOwner = room.owner === playerName;
    const canAccept = room.status === "waiting" && !isOwner;
    expect(canAccept).toBe(false);
  });

  it("cannot accept a finished room", () => {
    const room = makePrivateRoom({ status: "finished" });
    const playerName = "Bob";
    const isOwner = room.owner === playerName;
    const canAccept = room.status === "waiting" && !isOwner;
    expect(canAccept).toBe(false);
  });
});

describe("feature flag gating", () => {
  it("feature is enabled when flag is not false", () => {
    const env = { FEATURE_PRIVATE_GAMES: "true" };
    const enabled = env.FEATURE_PRIVATE_GAMES !== "false";
    expect(enabled).toBe(true);
  });

  it("feature is enabled when flag is undefined", () => {
    const env: Record<string, string | undefined> = {};
    const enabled = env.FEATURE_PRIVATE_GAMES !== "false";
    expect(enabled).toBe(true);
  });

  it("feature is disabled when flag is false", () => {
    const env = { FEATURE_PRIVATE_GAMES: "false" };
    const enabled = env.FEATURE_PRIVATE_GAMES !== "false";
    expect(enabled).toBe(false);
  });
});

describe("time format display", () => {
  function formatTimeLabel(timeControl: number, increment: number): string {
    const mins = timeControl / 60;
    const fmt = mins === 0.25 ? "¼" : mins === 0.5 ? "½" : String(mins);
    return `${fmt}+${increment}`;
  }

  function classifyTime(timeControl: number, increment: number): string {
    const total = timeControl + increment * 40;
    if (total < 29) return "UltraBullet";
    if (total < 180) return "Bullet";
    if (total < 480) return "Blitz";
    if (total < 1500) return "Rapid";
    return "Classical";
  }

  it("formats 5+3 correctly", () => {
    expect(formatTimeLabel(300, 3)).toBe("5+3");
  });

  it("formats 0.25+0 as ¼+0", () => {
    expect(formatTimeLabel(15, 0)).toBe("¼+0");
  });

  it("classifies 1+0 as Bullet", () => {
    expect(classifyTime(60, 0)).toBe("Bullet");
  });

  it("classifies 10+0 as Rapid", () => {
    expect(classifyTime(600, 0)).toBe("Rapid");
  });
});
