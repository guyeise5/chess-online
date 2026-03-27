import type { Server } from "socket.io";

export function isOnlinePlayerCountFeatureEnabled(): boolean {
  return process.env["FEATURE_ONLINE_PLAYER_COUNT"] !== "false";
}

/** Broadcasts the number of connected Socket.IO clients to all sockets. */
export function emitOnlinePlayerCount(io: Server): void {
  if (!isOnlinePlayerCountFeatureEnabled()) return;
  const raw = io.engine.clientsCount;
  const count = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  io.emit("presence:online-count", { count });
}
