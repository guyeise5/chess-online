import { useEffect, useState } from "react";
import { socket } from "../socket";
import { getEnv } from "../types";

/** Narrow Socket.IO payload from the server. */
export function parseOnlineCountPayload(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const raw = (payload as { count?: unknown }).count;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.floor(raw));
}

/**
 * Live count of Socket.IO connections (all tabs / pages that load the client socket).
 * `null` until the first server event.
 */
export function useOnlinePlayerCount(): number | null {
  const enabled = getEnv().FEATURE_ONLINE_PLAYER_COUNT !== "false";
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handler = (payload: unknown) => {
      const n = parseOnlineCountPayload(payload);
      if (n !== null) setCount(n);
    };

    socket.on("presence:online-count", handler);
    return () => {
      socket.off("presence:online-count", handler);
    };
  }, [enabled]);

  return enabled ? count : null;
}
