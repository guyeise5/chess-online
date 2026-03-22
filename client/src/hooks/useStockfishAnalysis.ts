import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";

export type MoveClassification =
  | "best"
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

function classifyCentipawnLoss(loss: number): MoveClassification {
  const l = Math.max(0, loss);
  if (l <= 10) return "best";
  if (l <= 25) return "good";
  if (l <= 50) return "inaccuracy";
  if (l <= 100) return "mistake";
  return "blunder";
}

function sideToMoveFromFen(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  return (parts[1] ?? "w") === "w";
}

function centipawnLossForMove(
  evalBeforeWhite: number,
  evalAfterWhite: number,
  whiteToMoveBefore: boolean
): number {
  return whiteToMoveBefore
    ? evalBeforeWhite - evalAfterWhite
    : evalAfterWhite - evalBeforeWhite;
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
        let lastAtDepth: { depth: number; whiteCp: number } | null = null;
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
              if (parsed && parsed.depth >= ANALYSIS_DEPTH) {
                lastAtDepth = parsed;
              }
              continue;
            }
            if (line.startsWith("bestmove")) {
              const bestMove = parseBestmove(line);
              finish({
                score: lastAtDepth?.whiteCp ?? 0,
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
          const prev = built[i - 1]!;
          try {
            const g = new Chess(baseFen);
            for (let k = 0; k < i - 1; k++) {
              const r = g.move(sanMoves[k]!);
              if (!r) break;
            }
            const whiteBefore = g.turn() === "w";
            const loss = centipawnLossForMove(prev.score, score, whiteBefore);
            entry.classification = classifyCentipawnLoss(loss);
          } catch {
            // skip classification if replay fails
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
