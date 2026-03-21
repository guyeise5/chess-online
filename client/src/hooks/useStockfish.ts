import { useEffect, useRef, useCallback, useState } from "react";

export interface StockfishLevel {
  level: number;
  skillLevel: number;
  depth: number;
  label: string;
  rating: string;
}

export const STOCKFISH_LEVELS: StockfishLevel[] = [
  { level: 1, skillLevel: 0,  depth: 1,  label: "Level 1", rating: "~800" },
  { level: 2, skillLevel: 2,  depth: 2,  label: "Level 2", rating: "~1100" },
  { level: 3, skillLevel: 5,  depth: 4,  label: "Level 3", rating: "~1400" },
  { level: 4, skillLevel: 8,  depth: 6,  label: "Level 4", rating: "~1700" },
  { level: 5, skillLevel: 11, depth: 9,  label: "Level 5", rating: "~2000" },
  { level: 6, skillLevel: 14, depth: 12, label: "Level 6", rating: "~2300" },
  { level: 7, skillLevel: 17, depth: 16, label: "Level 7", rating: "~2700" },
  { level: 8, skillLevel: 20, depth: 22, label: "Level 8", rating: "~3000" },
];

export function getLevelConfig(level: number): StockfishLevel {
  return STOCKFISH_LEVELS[Math.max(0, Math.min(level - 1, 7))];
}

export default function useStockfish(level: number) {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const pendingResolve = useRef<((move: string) => void) | null>(null);
  const initAttempted = useRef(false);

  useEffect(() => {
    initAttempted.current = false;
    setReady(false);

    let worker: Worker | null = null;
    try {
      worker = new Worker("/stockfish/stockfish-18-lite-single.js");
    } catch (err) {
      console.error("Failed to create Stockfish worker:", err);
      return;
    }
    workerRef.current = worker;

    worker.onerror = (e) => {
      console.error("Stockfish worker error:", e);
    };

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);

      if (line === "uciok") {
        const cfg = getLevelConfig(level);
        worker!.postMessage(`setoption name Skill Level value ${cfg.skillLevel}`);
        worker!.postMessage("isready");
      } else if (line === "readyok") {
        setReady(true);
      } else if (line.startsWith("bestmove")) {
        const move = line.split(" ")[1];
        if (move && pendingResolve.current) {
          pendingResolve.current(move);
          pendingResolve.current = null;
        }
      }
    };

    worker.postMessage("uci");
    initAttempted.current = true;

    return () => {
      if (worker) {
        try { worker.postMessage("quit"); } catch { /* already dead */ }
        worker.terminate();
      }
      workerRef.current = null;
      setReady(false);
    };
  }, [level]);

  const getMove = useCallback(
    (fen: string): Promise<string> => {
      return new Promise((resolve) => {
        const worker = workerRef.current;
        if (!worker) {
          resolve("0000");
          return;
        }
        pendingResolve.current = resolve;
        const cfg = getLevelConfig(level);
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${cfg.depth}`);
      });
    },
    [level]
  );

  const stop = useCallback(() => {
    if (workerRef.current) {
      try { workerRef.current.postMessage("stop"); } catch { /* ignore */ }
    }
    pendingResolve.current = null;
  }, []);

  return { ready, getMove, stop };
}
