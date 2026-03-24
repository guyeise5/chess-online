import { useEffect, useRef, useCallback, useState } from "react";

export interface StockfishLevel {
  level: number;
  skillLevel: number;
  depth: number;
  label: string;
  rating: string;
}

export const STOCKFISH_LEVELS: StockfishLevel[] = [
  { level: 1,  skillLevel: 0,  depth: 1,  label: "Level 1",  rating: "~600" },
  { level: 2,  skillLevel: 1,  depth: 2,  label: "Level 2",  rating: "~850" },
  { level: 3,  skillLevel: 2,  depth: 3,  label: "Level 3",  rating: "~1050" },
  { level: 4,  skillLevel: 4,  depth: 4,  label: "Level 4",  rating: "~1250" },
  { level: 5,  skillLevel: 6,  depth: 5,  label: "Level 5",  rating: "~1400" },
  { level: 6,  skillLevel: 8,  depth: 7,  label: "Level 6",  rating: "~1600" },
  { level: 7,  skillLevel: 10, depth: 9,  label: "Level 7",  rating: "~1850" },
  { level: 8,  skillLevel: 12, depth: 11, label: "Level 8",  rating: "~2050" },
  { level: 9,  skillLevel: 14, depth: 13, label: "Level 9",  rating: "~2300" },
  { level: 10, skillLevel: 17, depth: 16, label: "Level 10", rating: "~2500" },
  { level: 11, skillLevel: 19, depth: 22, label: "Level 11", rating: "~2850" },
  { level: 12, skillLevel: 20, depth: 30, label: "Level 12", rating: "~3200" },
];

export function getLevelConfig(level: number): StockfishLevel {
  return STOCKFISH_LEVELS[Math.max(0, Math.min(level - 1, 11))];
}

export default function useStockfish(level: number) {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const pendingResolve = useRef<((move: string) => void) | null>(null);
  const ignoreNextBestmove = useRef(false);
  const initAttempted = useRef(false);

  useEffect(() => {
    initAttempted.current = false;
    setReady(false);
    ignoreNextBestmove.current = false;

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
        if (ignoreNextBestmove.current) {
          ignoreNextBestmove.current = false;
          return;
        }
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
    if (pendingResolve.current) {
      ignoreNextBestmove.current = true;
    }
    pendingResolve.current = null;
  }, []);

  return { ready, getMove, stop };
}
