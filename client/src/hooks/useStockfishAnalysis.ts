import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export type MoveClassification =
  | "book"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface EvalEntry {
  score: number;
  bestMove: string;
  classification?: MoveClassification;
}

const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";
const ANALYSIS_DEPTH = 18;
const DEFAULT_START_FEN = new Chess().fen();

function engineCpToWhitePerspective(cp: number, whiteToMove: boolean): number {
  return whiteToMove ? cp : -cp;
}

function engineMateToWhitePerspective(mate: number, whiteToMove: boolean): number {
  let cpForMover: number;
  if (mate > 0) {
    cpForMover = 10000 - mate;
  } else {
    const n = Math.abs(mate);
    cpForMover = -10000 + n;
  }
  return whiteToMove ? cpForMover : -cpForMover;
}

function parseInfoEval(
  line: string,
  whiteToMove: boolean
): { depth: number; whiteCp: number } | null {
  if (!line.startsWith("info ")) return null;
  const depthMatch = /\bdepth\s+(\d+)\b/.exec(line);
  if (!depthMatch) return null;
  const depth = Number(depthMatch[1]);
  const cpMatch = /\bscore\s+cp\s+(-?\d+)\b/.exec(line);
  if (cpMatch) {
    const cp = Number(cpMatch[1]);
    return { depth, whiteCp: engineCpToWhitePerspective(cp, whiteToMove) };
  }
  const mateMatch = /\bscore\s+mate\s+(-?\d+)\b/.exec(line);
  if (mateMatch) {
    const mate = Number(mateMatch[1]);
    return { depth, whiteCp: engineMateToWhitePerspective(mate, whiteToMove) };
  }
  return null;
}

function parseBestmove(line: string): string {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== "bestmove" || parts.length < 2) return "";
  return parts[1] ?? "";
}

/**
 * Convert centipawn evaluation to winning chances using the Lichess
 * logistic model (coefficient from lichess-org/lila PR #11148).
 * Returns a value from -1 (black winning) to +1 (white winning).
 */
export function winningChances(cp: number): number {
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/**
 * Convert a SAN move to UCI notation given the position FEN.
 */
function sanToUci(fen: string, san: string): string {
  try {
    const g = new Chess(fen);
    const m = g.move(san);
    if (!m) return "";
    return m.from + m.to + (m.promotion || "");
  } catch {
    return "";
  }
}

/**
 * Classify a move based on the winning-chances delta and whether it
 * matches the engine's top choice.
 *
 * Thresholds follow chess.com's Expected Points model:
 *   best           engine's #1 move                  →  "best"
 *   excellent      ≤ 0.04 WC delta (not #1)          →  "excellent"
 *   good           0.04-0.10                          →  "good"
 *   inaccuracy     0.10-0.20                          →  "inaccuracy"
 *   mistake        0.20-0.40                          →  "mistake"
 *   blunder        > 0.40                             →  "blunder"
 */
export function classifyMove(delta: number, isBestMove: boolean): MoveClassification {
  if (delta > 0.4) return "blunder";
  if (delta > 0.2) return "mistake";
  if (delta > 0.1) return "inaccuracy";
  if (isBestMove) return "best";
  if (delta <= 0.04) return "excellent";
  return "good";
}

function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

const API_BASE = typeof window !== "undefined" && window.__ENV__
  ? ""
  : "http://localhost:3001";

async function fetchBookFlags(fens: string[]): Promise<boolean[]> {
  const flags = (typeof window !== "undefined" && window.__ENV__) || {};
  if (flags.FEATURE_OPENING_BOOK === "false") {
    return fens.map(() => false);
  }
  try {
    const keys = fens.map(positionKey);
    const res = await fetch(`${API_BASE}/api/openings/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fens: keys }),
    });
    if (!res.ok) return fens.map(() => false);
    const data = await res.json();
    return Array.isArray(data?.book) ? data.book : fens.map(() => false);
  } catch {
    return fens.map(() => false);
  }
}

function sideToMoveFromFen(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  return (parts[1] ?? "w") === "w";
}

function terminalScore(fen: string): number | null {
  const g = new Chess(fen);
  if (g.isCheckmate()) {
    return g.turn() === "w" ? -10000 : 10000;
  }
  if (g.isStalemate() || g.isDraw() || g.isThreefoldRepetition() || g.isInsufficientMaterial()) {
    return 0;
  }
  return null;
}

function buildFensForGame(startFen: string, sanMoves: string[]): string[] {
  const game = new Chess(startFen);
  const fens: string[] = [game.fen()];
  for (const san of sanMoves) {
    try {
      const r = game.move(san);
      if (!r) break;
      fens.push(game.fen());
    } catch {
      break;
    }
  }
  return fens;
}

function splitWorkerData(data: unknown): string[] {
  const text = typeof data === "string" ? data : String(data);
  return text.split(/\n/).map((s) => s.trim()).filter(Boolean);
}

export function useStockfishAnalysis(
  moves: string[],
  startFen?: string
): {
  evals: EvalEntry[];
  progress: number;
  analyzing: boolean;
  startAnalysis: () => void;
} {
  const [evals, setEvals] = useState<EvalEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const engineReadyRef = useRef(false);
  const unmountedRef = useRef(false);
  const runGenerationRef = useRef(0);

  const movesRef = useRef(moves);
  movesRef.current = moves;
  const startFenRef = useRef(startFen ?? DEFAULT_START_FEN);
  startFenRef.current = startFen ?? DEFAULT_START_FEN;

  const pendingAnalysisFinishRef = useRef<
    ((r: { score: number; bestMove: string }) => void) | null
  >(null);

  useEffect(() => {
    unmountedRef.current = false;
    engineReadyRef.current = false;
    let worker: Worker | null = null;
    try {
      worker = new Worker(STOCKFISH_WORKER_URL);
    } catch {
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const lines = splitWorkerData(e.data);
      for (const line of lines) {
        if (line === "uciok") {
          worker!.postMessage("isready");
        } else if (line === "readyok") {
          engineReadyRef.current = true;
        }
      }
    };

    worker.postMessage("uci");

    return () => {
      unmountedRef.current = true;
      pendingAnalysisFinishRef.current?.({ score: 0, bestMove: "" });
      pendingAnalysisFinishRef.current = null;
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
      engineReadyRef.current = false;
    };
  }, []);

  const analyzeFen = useCallback(
    (fen: string): Promise<{ score: number; bestMove: string }> => {
      const worker = workerRef.current;
      if (!worker) {
        return Promise.resolve({ score: 0, bestMove: "" });
      }
      const whiteToMove = sideToMoveFromFen(fen);
      return new Promise((resolve) => {
        let bestEval: { depth: number; whiteCp: number } | null = null;
        let settled = false;
        const finish = (result: { score: number; bestMove: string }) => {
          if (settled) return;
          settled = true;
          pendingAnalysisFinishRef.current = null;
          worker.removeEventListener("message", onMessage);
          resolve(result);
        };
        pendingAnalysisFinishRef.current = finish;
        const onMessage = (e: MessageEvent) => {
          const lines = splitWorkerData(e.data);
          for (const line of lines) {
            if (line.startsWith("info ")) {
              const parsed = parseInfoEval(line, whiteToMove);
              if (parsed && (!bestEval || parsed.depth >= bestEval.depth)) {
                bestEval = parsed;
              }
              continue;
            }
            if (line.startsWith("bestmove")) {
              const bestMove = parseBestmove(line);
              finish({
                score: bestEval?.whiteCp ?? 0,
                bestMove,
              });
              return;
            }
          }
        };
        worker.addEventListener("message", onMessage);
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${ANALYSIS_DEPTH}`);
      });
    },
    []
  );

  const startAnalysis = useCallback(() => {
    const gen = ++runGenerationRef.current;
    const worker = workerRef.current;
    if (!worker) return;
    pendingAnalysisFinishRef.current?.({ score: 0, bestMove: "" });
    try {
      worker.postMessage("stop");
    } catch {
      /* ignore */
    }

    void (async () => {
      await new Promise<void>((resolve) => {
        if (engineReadyRef.current) {
          resolve();
          return;
        }
        const t = window.setInterval(() => {
          if (unmountedRef.current || gen !== runGenerationRef.current) {
            window.clearInterval(t);
            resolve();
            return;
          }
          if (engineReadyRef.current) {
            window.clearInterval(t);
            resolve();
          }
        }, 20);
      });

      if (unmountedRef.current || gen !== runGenerationRef.current) {
        setAnalyzing(false);
        return;
      }
      if (!engineReadyRef.current) return;

      const sanMoves = movesRef.current;
      const baseFen = startFenRef.current;
      let fens: string[];
      try {
        fens = buildFensForGame(baseFen, sanMoves);
      } catch {
        setEvals([]);
        setProgress(0);
        setAnalyzing(false);
        return;
      }

      setAnalyzing(true);
      setProgress(0);
      setEvals([]);

      const bookFlags = await fetchBookFlags(fens);
      if (unmountedRef.current || gen !== runGenerationRef.current) {
        setAnalyzing(false);
        return;
      }

      let bookEnded = false;
      const built: EvalEntry[] = [];
      const total = fens.length;

      for (let i = 0; i < total; i++) {
        if (unmountedRef.current || gen !== runGenerationRef.current) {
          setAnalyzing(false);
          return;
        }

        const terminal = terminalScore(fens[i]!);
        let score: number;
        let bestMove: string;
        if (terminal !== null) {
          score = terminal;
          bestMove = "";
        } else {
          const result = await analyzeFen(fens[i]!);
          if (unmountedRef.current || gen !== runGenerationRef.current) {
            setAnalyzing(false);
            return;
          }
          score = result.score;
          bestMove = result.bestMove;
        }

        const entry: EvalEntry = { score, bestMove };
        if (i > 0) {
          if (!bookEnded && bookFlags[i]) {
            entry.classification = "book";
          } else {
            bookEnded = true;
            const prev = built[i - 1]!;
            const whiteToMoveBefore = sideToMoveFromFen(fens[i - 1]!);
            const wcBefore = winningChances(prev.score);
            const wcAfter = winningChances(score);
            const delta = whiteToMoveBefore
              ? wcBefore - wcAfter
              : wcAfter - wcBefore;
            const prevSan = sanMoves[i - 1];
            const playedUci =
              typeof prevSan === "string"
                ? sanToUci(fens[i - 1]!, prevSan)
                : "";
            const isBest =
              !!prev.bestMove &&
              playedUci !== "" &&
              playedUci === prev.bestMove;
            entry.classification = classifyMove(Math.max(0, delta), isBest);
          }
        }
        built.push(entry);
        setEvals([...built]);
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      if (unmountedRef.current || gen !== runGenerationRef.current) {
        setAnalyzing(false);
        return;
      }
      setAnalyzing(false);
    })();
  }, [analyzeFen]);

  return { evals, progress, analyzing, startAnalysis };
}
