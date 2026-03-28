import type { Server, Socket } from "socket.io";

export function isOnlinePlayerCountFeatureEnabled(): boolean {
  return process.env["FEATURE_ONLINE_PLAYER_COUNT"] !== "false";
}

function getOnlineCount(io: Server): number {
  const raw = io.engine.clientsCount;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

/** Broadcasts the number of connected Socket.IO clients to all sockets. */
export function emitOnlinePlayerCount(io: Server): void {
  if (!isOnlinePlayerCountFeatureEnabled()) return;
  io.emit("presence:online-count", { count: getOnlineCount(io) });
}

/** Sends the current count to a single socket (on-demand request). */
export function emitOnlinePlayerCountToSocket(io: Server, socket: Socket): void {
  if (!isOnlinePlayerCountFeatureEnabled()) return;
  socket.emit("presence:online-count", { count: getOnlineCount(io) });
}
