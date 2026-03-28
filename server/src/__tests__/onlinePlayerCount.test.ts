import type { Server, Socket } from "socket.io";
import {
  emitOnlinePlayerCount,
  emitOnlinePlayerCountToSocket,
  isOnlinePlayerCountFeatureEnabled,
} from "../socket/onlinePlayerCount";

describe("onlinePlayerCount", () => {
  const original = process.env["FEATURE_ONLINE_PLAYER_COUNT"];

  afterEach(() => {
    if (original === undefined) {
      delete process.env["FEATURE_ONLINE_PLAYER_COUNT"];
    } else {
      process.env["FEATURE_ONLINE_PLAYER_COUNT"] = original;
    }
  });

  it("isOnlinePlayerCountFeatureEnabled is false only when env is false", () => {
    delete process.env["FEATURE_ONLINE_PLAYER_COUNT"];
    expect(isOnlinePlayerCountFeatureEnabled()).toBe(true);
    process.env["FEATURE_ONLINE_PLAYER_COUNT"] = "false";
    expect(isOnlinePlayerCountFeatureEnabled()).toBe(false);
  });

  it("emitOnlinePlayerCount emits engine.clientsCount when enabled", () => {
    delete process.env["FEATURE_ONLINE_PLAYER_COUNT"];
    const emit = jest.fn();
    const io = {
      engine: { clientsCount: 4 },
      emit,
    } as unknown as Server;
    emitOnlinePlayerCount(io);
    expect(emit).toHaveBeenCalledWith("presence:online-count", { count: 4 });
  });

  it("emitOnlinePlayerCount clamps invalid counts to 0", () => {
    delete process.env["FEATURE_ONLINE_PLAYER_COUNT"];
    const emit = jest.fn();
    const io = {
      engine: { clientsCount: NaN },
      emit,
    } as unknown as Server;
    emitOnlinePlayerCount(io);
    expect(emit).toHaveBeenCalledWith("presence:online-count", { count: 0 });
  });

  it("emitOnlinePlayerCount no-ops when feature is disabled", () => {
    process.env["FEATURE_ONLINE_PLAYER_COUNT"] = "false";
    const emit = jest.fn();
    const io = {
      engine: { clientsCount: 2 },
      emit,
    } as unknown as Server;
    emitOnlinePlayerCount(io);
    expect(emit).not.toHaveBeenCalled();
  });

  it("emitOnlinePlayerCountToSocket sends count to a single socket", () => {
    delete process.env["FEATURE_ONLINE_PLAYER_COUNT"];
    const ioEmit = jest.fn();
    const socketEmit = jest.fn();
    const io = {
      engine: { clientsCount: 7 },
      emit: ioEmit,
    } as unknown as Server;
    const sock = { emit: socketEmit } as unknown as Socket;
    emitOnlinePlayerCountToSocket(io, sock);
    expect(socketEmit).toHaveBeenCalledWith("presence:online-count", { count: 7 });
    expect(ioEmit).not.toHaveBeenCalled();
  });

  it("emitOnlinePlayerCountToSocket no-ops when feature is disabled", () => {
    process.env["FEATURE_ONLINE_PLAYER_COUNT"] = "false";
    const socketEmit = jest.fn();
    const io = {
      engine: { clientsCount: 3 },
      emit: jest.fn(),
    } as unknown as Server;
    const sock = { emit: socketEmit } as unknown as Socket;
    emitOnlinePlayerCountToSocket(io, sock);
    expect(socketEmit).not.toHaveBeenCalled();
  });
});
