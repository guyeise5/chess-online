import { useEffect, useState, useRef } from "react";
import { socket } from "../socket";
import { getEnv } from "../types";

export type SignalStrength = 0 | 1 | 2 | 3 | 4;

export interface ConnectionStatus {
  connected: boolean;
  latency: number | null;
  strength: SignalStrength;
}

const PING_INTERVAL = 5_000;

export function latencyToStrength(ms: number | null, connected: boolean): SignalStrength {
  if (!connected || ms === null) return 0;
  if (ms < 100) return 4;
  if (ms < 300) return 3;
  if (ms < 600) return 2;
  return 1;
}

export function useConnectionStatus(): ConnectionStatus {
  const enabled = getEnv().FEATURE_CONNECTION_STATUS !== "false";
  const [connected, setConnected] = useState(() => socket.connected);
  const [latency, setLatency] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const measureLatency = () => {
      if (!socket.connected) return;
      const start = performance.now();
      socket.emit("ping:latency", { ts: Date.now() }, () => {
        const rtt = Math.round(performance.now() - start);
        setLatency(rtt);
      });
    };

    const onConnect = () => {
      setConnected(true);
      measureLatency();
    };
    const onDisconnect = () => {
      setConnected(false);
      setLatency(null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) measureLatency();
    intervalRef.current = setInterval(measureLatency, PING_INTERVAL);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  const strength = enabled ? latencyToStrength(latency, connected) : 0;

  if (!enabled) return { connected: false, latency: null, strength: 0 };

  return { connected, latency, strength };
}
