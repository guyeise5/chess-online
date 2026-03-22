import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export interface PVLine {
  rank: number;
  score: number;
  mate: number | null;
  san: string[];
  depth: number;
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

interface AnalysisState {
  gen: number;
  fen: string;
  whiteToMove: boolean;
  goSent: boolean;
  collected: Map<number, PVLine>;
  lastFlushedDepth: number;
}

const WATCHDOG_MS = 10_000;

export default function useMultiPV(fen: string | null) {
  const [lines, setLines] = useState<PVLine[]>([]);
  const [computing, setComputing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const unmountedRef = useRef(false);
  const genRef = useRef(0);
  const stateRef = useRef<AnalysisState | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

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

    const handler = (e: MessageEvent) => {
      for (const line of splitLines(e.data)) {
        if (line === "uciok") {
          worker!.postMessage(`setoption name MultiPV value ${NUM_PV}`);
          worker!.postMessage("isready");
          continue;
        }

        if (line === "readyok") {
          readyRef.current = true;

          const s = stateRef.current;
          if (!s || s.gen !== genRef.current || s.goSent) continue;

          s.goSent = true;
          worker!.postMessage(`position fen ${s.fen}`);
          worker!.postMessage(`go depth ${DEPTH}`);
          continue;
        }

        const s = stateRef.current;
        if (!s || s.gen !== genRef.current || !s.goSent) continue;

        if (line.startsWith("info ") && /\bdepth\b/.test(line)) {
          const depthMatch = /\bdepth\s+(\d+)\b/.exec(line);
          const pvIdx = /\bmultipv\s+(\d+)\b/.exec(line);
          const pvMoves = /\bpv\s+(.+)$/.exec(line);
          if (!depthMatch || !pvIdx || !pvMoves) continue;

          const depth = Number(depthMatch[1]);
          const rank = Number(pvIdx[1]);
          const uciMoves = pvMoves[1].trim().split(/\s+/);

          let score = 0;
          let mate: number | null = null;
          const cpMatch = /\bscore\s+cp\s+(-?\d+)\b/.exec(line);
          const mateMatch = /\bscore\s+mate\s+(-?\d+)\b/.exec(line);

          if (cpMatch) {
            score = Number(cpMatch[1]);
            if (!s.whiteToMove) score = -score;
          } else if (mateMatch) {
            const m = Number(mateMatch[1]);
            mate = s.whiteToMove ? m : -m;
            score =
              m > 0
                ? s.whiteToMove
                  ? 10000 - m
                  : -(10000 - m)
                : s.whiteToMove
                  ? -(10000 - Math.abs(m))
                  : 10000 - Math.abs(m);
          }

          const parsed = uciToSan(s.fen, uciMoves);
          if (parsed.san.length > 0) {
            s.collected.set(rank, {
              rank,
              score,
              mate,
              depth,
              san: parsed.san,
              firstMove: parsed.firstMove,
            });
          }

          if (rank === NUM_PV || depth > s.lastFlushedDepth) {
            s.lastFlushedDepth = depth;
            if (s.gen === genRef.current && !unmountedRef.current) {
              setLines(
                Array.from(s.collected.values()).sort(
                  (a, b) => a.rank - b.rank
                )
              );
            }
          }
        }

        if (line.startsWith("bestmove")) {
          if (s.gen === genRef.current && s.goSent && !unmountedRef.current) {
            setLines(
              Array.from(s.collected.values()).sort(
                (a, b) => a.rank - b.rank
              )
            );
            setComputing(false);
            clearWatchdog();
          }
        }
      }
    };

    worker.addEventListener("message", handler);
    worker.postMessage("uci");

    return () => {
      unmountedRef.current = true;
      stateRef.current = null;
      clearWatchdog();
      if (worker) {
        worker.removeEventListener("message", handler);
        try { worker.postMessage("stop"); } catch { /* */ }
        try { worker.postMessage("quit"); } catch { /* */ }
        worker.terminate();
      }
      workerRef.current = null;
      readyRef.current = false;
    };
  }, [clearWatchdog]);

  const analyze = useCallback((targetFen: string) => {
    const worker = workerRef.current;
    if (!worker || unmountedRef.current) return;

    const gen = ++genRef.current;
    stateRef.current = {
      gen,
      fen: targetFen,
      whiteToMove: targetFen.split(/\s+/)[1] !== "b",
      goSent: false,
      collected: new Map(),
      lastFlushedDepth: 0,
    };
    setLines([]);
    setComputing(true);

    try { worker.postMessage("stop"); } catch { /* */ }
    worker.postMessage("isready");

    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (genRef.current === gen && !unmountedRef.current) {
        stateRef.current = {
          gen,
          fen: targetFen,
          whiteToMove: targetFen.split(/\s+/)[1] !== "b",
          goSent: false,
          collected: new Map(),
          lastFlushedDepth: 0,
        };
        setLines([]);
        try { worker.postMessage("stop"); } catch { /* */ }
        worker.postMessage("isready");
      }
    }, WATCHDOG_MS);
  }, [clearWatchdog]);

  useEffect(() => {
    const worker = workerRef.current;

    if (!fen) {
      genRef.current++;
      stateRef.current = null;
      setLines([]);
      setComputing(false);
      clearWatchdog();
      if (worker) { try { worker.postMessage("stop"); } catch { /* */ } }
      return;
    }

    try {
      const g = new Chess(fen);
      if (g.isGameOver()) {
        genRef.current++;
        stateRef.current = null;
        setLines([]);
        setComputing(false);
        clearWatchdog();
        if (worker) { try { worker.postMessage("stop"); } catch { /* */ } }
        return;
      }
    } catch {
      genRef.current++;
      stateRef.current = null;
      setLines([]);
      setComputing(false);
      clearWatchdog();
      if (worker) { try { worker.postMessage("stop"); } catch { /* */ } }
      return;
    }

    genRef.current++;
    setLines([]);
    setComputing(true);
    clearWatchdog();
    if (worker) { try { worker.postMessage("stop"); } catch { /* */ } }
    stateRef.current = null;

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

    const timer = setTimeout(() => analyze(fen), 50);
    return () => clearTimeout(timer);
  }, [fen, analyze, clearWatchdog]);

  return { lines, computing };
}
