import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export interface PVLine {
  rank: number;
  score: number;
  mate: number | null;
  san: string[];
  firstMove: { from: string; to: string } | null;
}

const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";
const DEPTH = 18;
const NUM_PV = 5;

function uciToSan(
  fen: string,
  uciMoves: string[]
): { san: string[]; firstMove: { from: string; to: string } | null } {
  try {
    const g = new Chess(fen);
    const san: string[] = [];
    let firstMove: { from: string; to: string } | null = null;
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promo = uci.length > 4 ? uci[4] : undefined;
      const move = g.move({ from, to, promotion: promo });
      if (!move) break;
      if (san.length === 0) firstMove = { from: move.from, to: move.to };
      san.push(move.san);
    }
    return { san, firstMove };
  } catch {
    return { san: [], firstMove: null };
  }
}

function splitLines(data: unknown): string[] {
  const text = typeof data === "string" ? data : String(data);
  return text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function useMultiPV(fen: string | null) {
  const [lines, setLines] = useState<PVLine[]>([]);
  const [computing, setComputing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const unmountedRef = useRef(false);
  const currentFenRef = useRef<string | null>(null);

  useEffect(() => {
    unmountedRef.current = false;
    readyRef.current = false;

    let worker: Worker | null = null;
    try {
      worker = new Worker(STOCKFISH_WORKER_URL);
    } catch {
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      for (const line of splitLines(e.data)) {
        if (line === "uciok") {
          worker!.postMessage(`setoption name MultiPV value ${NUM_PV}`);
          worker!.postMessage("isready");
        } else if (line === "readyok") {
          readyRef.current = true;
        }
      }
    };

    worker.postMessage("uci");

    return () => {
      unmountedRef.current = true;
      if (worker) {
        try {
          worker.postMessage("stop");
        } catch {
          /* ignore */
        }
        try {
          worker.postMessage("quit");
        } catch {
          /* ignore */
        }
        worker.terminate();
      }
      workerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  const analyze = useCallback((targetFen: string) => {
    const worker = workerRef.current;
    if (!worker || unmountedRef.current) return;

    currentFenRef.current = targetFen;
    setComputing(true);

    try {
      worker.postMessage("stop");
    } catch {
      /* ignore */
    }

    const whiteToMove = targetFen.split(/\s+/)[1] !== "b";
    const collected = new Map<number, PVLine>();

    const onMessage = (e: MessageEvent) => {
      if (currentFenRef.current !== targetFen) return;

      for (const line of splitLines(e.data)) {
        if (line.startsWith("info ") && /\bdepth\b/.test(line)) {
          const depthMatch = /\bdepth\s+(\d+)\b/.exec(line);
          const pvIdx = /\bmultipv\s+(\d+)\b/.exec(line);
          const pvMoves = /\bpv\s+(.+)$/.exec(line);
          if (!depthMatch || !pvIdx || !pvMoves) continue;

          const depth = Number(depthMatch[1]);
          if (depth < DEPTH) continue;

          const rank = Number(pvIdx[1]);
          const uciMoves = pvMoves[1].trim().split(/\s+/);

          let score = 0;
          let mate: number | null = null;
          const cpMatch = /\bscore\s+cp\s+(-?\d+)\b/.exec(line);
          const mateMatch = /\bscore\s+mate\s+(-?\d+)\b/.exec(line);

          if (cpMatch) {
            score = Number(cpMatch[1]);
            if (!whiteToMove) score = -score;
          } else if (mateMatch) {
            const m = Number(mateMatch[1]);
            mate = whiteToMove ? m : -m;
            score = m > 0
              ? (whiteToMove ? 10000 - m : -(10000 - m))
              : (whiteToMove ? -(10000 - Math.abs(m)) : 10000 - Math.abs(m));
          }

          const parsed = uciToSan(targetFen, uciMoves);
          if (parsed.san.length > 0) {
            collected.set(rank, {
              rank,
              score,
              mate,
              san: parsed.san,
              firstMove: parsed.firstMove,
            });
          }
        }

        if (line.startsWith("bestmove")) {
          worker!.removeEventListener("message", onMessage);
          if (currentFenRef.current === targetFen && !unmountedRef.current) {
            const sorted = Array.from(collected.values()).sort(
              (a, b) => a.rank - b.rank
            );
            setLines(sorted);
            setComputing(false);
          }
        }
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage("ucinewgame");
    worker.postMessage(`position fen ${targetFen}`);
    worker.postMessage(`go depth ${DEPTH}`);
  }, []);

  useEffect(() => {
    if (!fen) {
      setLines([]);
      return;
    }

    const g = new Chess(fen);
    if (g.isGameOver()) {
      setLines([]);
      return;
    }

    if (!readyRef.current) {
      const t = setInterval(() => {
        if (unmountedRef.current) {
          clearInterval(t);
          return;
        }
        if (readyRef.current) {
          clearInterval(t);
          analyze(fen);
        }
      }, 20);
      return () => clearInterval(t);
    }

    analyze(fen);
  }, [fen, analyze]);

  return { lines, computing };
}
