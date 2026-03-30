import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import {
  useStockfishAnalysis,
  type MoveClassification,
} from "../hooks/useStockfishAnalysis";
import useMultiPV from "../hooks/useMultiPV";
import EvalBar, { formatEvalLabel } from "./EvalBar";
import ScoreGraph from "./ScoreGraph";
import { computeMaterialDiff, type SideMaterial } from "../utils/materialDiff";
import MaterialDisplay from "./MaterialDisplay";
import NavBar from "./NavBar";
import { getEnv } from "../types";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./AnalysisBoard.module.css";

const HIGHLIGHT_LAST_MOVE: React.CSSProperties = {
  backgroundColor: "rgba(155, 199, 0, 0.41)",
};
const HIGHLIGHT_CHECK: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,76,60,0.5) 40%, rgba(169,32,32,0.15) 70%, transparent 100%)",
};
const HIGHLIGHT_SOURCE: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 0, 0.4)",
};
const HIGHLIGHT_DOT: React.CSSProperties = {
  background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
};
const HIGHLIGHT_CAPTURE: React.CSSProperties = {
  background: "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)",
};

const CLASSIFICATION_TEXT: Record<MoveClassification, string> = {
  book: "",
  forced: "",
  best: "",
  excellent: "",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  book: "#a88b5a",
  forced: "#a3a3a3",
  best: "#96bc4b",
  excellent: "#96bc4b",
  good: "#81a93e",
  inaccuracy: "#f7c631",
  mistake: "#e68f3c",
  blunder: "#ca3431",
};

function AnnotationIcon({
  classification,
  size,
}: {
  classification: MoveClassification;
  size: number;
}) {
  if (classification === "book") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3zm20 0h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3z" />
      </svg>
    );
  }
  if (classification === "forced") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
        <path d="M5 3l14 9-14 9V3z" />
      </svg>
    );
  }
  if (classification === "best") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
      </svg>
    );
  }
  if (classification === "excellent") {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} fill="white">
        <path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733.058.119.103.242.138.363.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z" />
      </svg>
    );
  }
  if (classification === "good") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="white">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    );
  }
  return null;
}

function AnnotationContent({
  classification,
  iconSize,
}: {
  classification: MoveClassification;
  iconSize: number;
}) {
  const text = CLASSIFICATION_TEXT[classification];
  if (text) return <>{text}</>;
  return <AnnotationIcon classification={classification} size={iconSize} />;
}

export interface AnalysisGameData {
  moves: string[];
  startFen?: string;
  playerWhite?: string;
  playerBlack?: string;
  displayWhite?: string;
  displayBlack?: string;
  orientation?: "white" | "black";
  result?: string;
}

const API_BASE = import.meta.env.PROD ? "" : "http://localhost:3001";

export function saveAnalysisGame(gameId: string, data: AnalysisGameData) {
  fetch(`${API_BASE}/api/games/${gameId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  }).catch(() => {});
}

async function loadAnalysisGame(
  gameId: string
): Promise<AnalysisGameData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/games/${gameId}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object" || !Array.isArray(data.moves)) return null;
    return data;
  } catch {
    return null;
  }
}

function uciMovesToSan(fen: string, uciMoves: string[]): string[] {
  const g = new Chess(fen);
  const sans: string[] = [];
  for (const uci of uciMoves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const m = g.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (!m) break;
    sans.push(m.san);
  }
  return sans;
}

export async function loadPuzzleForAnalysis(
  puzzleId: string
): Promise<AnalysisGameData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/puzzles/${puzzleId}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object" || typeof data.fen !== "string" || !Array.isArray(data.moves)) return null;
    const g = new Chess(data.fen);
    const orientation: "white" | "black" = g.turn() === "w" ? "black" : "white";
    return {
      startFen: data.fen,
      moves: uciMovesToSan(data.fen, data.moves),
      playerWhite: orientation === "white" ? "You" : "Opponent",
      playerBlack: orientation === "black" ? "You" : "Opponent",
      orientation,
    };
  } catch {
    return null;
  }
}

export function generateGameId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function findKingSquare(game: Chess): string | null {
  const turn = game.turn();
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    const row = board[r];
    if (!row) continue;
    for (let c = 0; c < 8; c++) {
      const piece = row[c];
      if (piece && piece.type === "k" && piece.color === turn) {
        return piece.square;
      }
    }
  }
  return null;
}

export interface Variation {
  from: number;
  moves: string[];
}

export type Nav =
  | { on: "main"; index: number }
  | { on: "var"; vi: number; mi: number };

export function inferOrientation(
  gameData: AnalysisGameData | null,
  userId?: string
): "white" | "black" {
  if (userId && gameData?.playerWhite === userId) return "white";
  if (userId && gameData?.playerBlack === userId) return "black";
  if (gameData?.orientation) return gameData.orientation;
  return "white";
}

export function fenAfterMoves(startFen: string | undefined, moves: string[]): string {
  try {
    const g = new Chess(startFen);
    for (const san of moves) g.move(san);
    return g.fen();
  } catch {
    return startFen ?? new Chess().fen();
  }
}

export function navFen(
  startFen: string | undefined,
  gameMoves: string[],
  variations: Variation[],
  nav: Nav
): string {
  if (nav.on === "main") {
    const idx = Math.min(nav.index, gameMoves.length);
    return fenAfterMoves(startFen, gameMoves.slice(0, idx));
  }
  const v = variations[nav.vi];
  if (!v) return fenAfterMoves(startFen, []);
  const mi = Math.min(nav.mi, v.moves.length - 1);
  return fenAfterMoves(startFen, [
    ...gameMoves.slice(0, v.from),
    ...v.moves.slice(0, mi + 1),
  ]);
}

export function navLastMove(
  startFen: string | undefined,
  gameMoves: string[],
  variations: Variation[],
  nav: Nav
): { from: string; to: string } | null {
  let prevMoves: string[];
  let san: string;
  if (nav.on === "main") {
    if (nav.index === 0) return null;
    prevMoves = gameMoves.slice(0, nav.index - 1);
    const w = gameMoves[nav.index - 1];
    if (w === undefined) return null;
    san = w;
  } else {
    const v = variations[nav.vi];
    if (!v) return null;
    if (nav.mi === 0) {
      prevMoves = gameMoves.slice(0, v.from);
    } else {
      prevMoves = [...gameMoves.slice(0, v.from), ...v.moves.slice(0, nav.mi)];
    }
    const bm = v.moves[nav.mi];
    if (bm === undefined) return null;
    san = bm;
  }
  try {
    const g = new Chess(startFen);
    for (const m of prevMoves) g.move(m);
    const move = g.move(san);
    return move ? { from: move.from, to: move.to } : null;
  } catch {
    return null;
  }
}

interface AnalysisBoardProps {
  userId: string;
  displayName: string;
  boardPrefs: BoardPreferences;
  onOpenSettings?: () => void;
}

export default function AnalysisBoard({ userId, displayName, boardPrefs, onOpenSettings }: AnalysisBoardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const routeState = location.state as AnalysisGameData | undefined;
  const isPuzzleRoute = location.pathname.startsWith("/analyzePuzzle/");

  const [gameData, setGameData] = useState<AnalysisGameData | null>(
    routeState?.moves?.length ? routeState : null
  );
  const [loading, setLoading] = useState(!gameData && !!gameId);

  useEffect(() => {
    if (gameData || !gameId) return;
    let cancelled = false;
    const loader = isPuzzleRoute ? loadPuzzleForAnalysis(gameId) : loadAnalysisGame(gameId);
    loader.then((data) => {
      if (cancelled) return;
      setGameData(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [gameId, gameData, isPuzzleRoute]);

  const { gameMoves, movesTruncated } = useMemo(() => {
    const raw = gameData?.moves ?? [];
    if (raw.length === 0) return { gameMoves: raw, movesTruncated: false };
    const g = new Chess(gameData?.startFen);
    const valid: string[] = [];
    for (const san of raw) {
      try {
        const m = g.move(san);
        if (!m) break;
        valid.push(san);
      } catch {
        break;
      }
    }
    return { gameMoves: valid, movesTruncated: valid.length < raw.length };
  }, [gameData]);
  const startFen = gameData?.startFen;
  const orientation = inferOrientation(gameData, userId);
  const playerWhite =
    gameData?.displayWhite ?? gameData?.playerWhite ?? "White";
  const playerBlack =
    gameData?.displayBlack ?? gameData?.playerBlack ?? "Black";

  const { evals, progress, analyzing, startAnalysis } = useStockfishAnalysis(
    gameMoves,
    startFen
  );

  const [variations, setVariations] = useState<Variation[]>([]);

  const initialPly = useMemo(() => {
    const p = parseInt(searchParams.get("ply") ?? "", 10);
    return Number.isFinite(p) && p >= 0 ? p : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [nav, setNav] = useState<Nav>(() => {
    if (initialPly !== null && initialPly <= gameMoves.length) {
      return { on: "main", index: initialPly };
    }
    return { on: "main", index: gameMoves.length };
  });

  const navRef = useRef(nav);
  navRef.current = nav;
  const variationsRef = useRef(variations);
  variationsRef.current = variations;

  const [hoverArrow, setHoverArrow] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const currentFen = useMemo(
    () => navFen(startFen, gameMoves, variations, nav),
    [startFen, gameMoves, variations, nav]
  );
  const displayedGame = useMemo(() => {
    try {
      return new Chess(currentFen);
    } catch {
      return new Chess();
    }
  }, [currentFen]);

  const materialDiff = useMemo(
    () => computeMaterialDiff(displayedGame),
    [displayedGame]
  );
  const showMaterial =
    getEnv().FEATURE_MATERIAL_DIFF !== "false";

  const getLegalMovesForSquare = useCallback(
    (square: string): string[] => {
      try {
        return displayedGame
          .moves({ square: square as Square, verbose: true })
          .map((m) => m.to);
      } catch {
        return [];
      }
    },
    [displayedGame]
  );

  const { lines: pvLines, computing: pvComputing } = useMultiPV(
    gameMoves.length > 0 || (nav.on === "var") ? currentFen : null
  );

  const lastMoveSquares = useMemo(
    () => navLastMove(startFen, gameMoves, variations, nav),
    [startFen, gameMoves, variations, nav]
  );

  const highlightStyles = useMemo((): Record<string, React.CSSProperties> => {
    const result: Record<string, React.CSSProperties> = {};
    if (lastMoveSquares) {
      result[lastMoveSquares.from] = HIGHLIGHT_LAST_MOVE;
      result[lastMoveSquares.to] = HIGHLIGHT_LAST_MOVE;
    }
    if (displayedGame.inCheck()) {
      const kingSq = findKingSquare(displayedGame);
      if (kingSq) result[kingSq] = HIGHLIGHT_CHECK;
    }
    if (selectedSquare) {
      result[selectedSquare] = HIGHLIGHT_SOURCE;
      const targets = getLegalMovesForSquare(selectedSquare);
      for (const sq of targets) {
        const pieceOnTarget = displayedGame.get(sq as Square);
        result[sq] = pieceOnTarget ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT;
      }
    }
    return result;
  }, [lastMoveSquares, displayedGame, selectedSquare, getLegalMovesForSquare]);

  useEffect(() => {
    startAnalysis();
  }, [startAnalysis]);

  useEffect(() => {
    const ply = nav.on === "main" ? nav.index : variations[nav.vi]?.from ?? 0;
    const url = new URL(window.location.href);
    url.searchParams.set("ply", String(ply));
    window.history.replaceState(null, "", url.toString());
  }, [nav, variations]);

  /* ---- play moves ---- */

  const playMove = useCallback(
    (san: string) => {
      const n = navRef.current;
      const vars = variationsRef.current;
      if (n.on === "main") {
        if (n.index < gameMoves.length && san === gameMoves[n.index]) {
          setNav({ on: "main", index: n.index + 1 });
          return;
        }
        const existing = vars.findIndex(
          (v) => v.from === n.index && v.moves[0] === san
        );
        if (existing >= 0) {
          setNav({ on: "var", vi: existing, mi: 0 });
          return;
        }
        setVariations((prev) => {
          const newVi = prev.length;
          setNav({ on: "var", vi: newVi, mi: 0 });
          return [...prev, { from: n.index, moves: [san] }];
        });
      } else {
        const v = vars[n.vi];
        if (!v) return;
        const nextMi = n.mi + 1;
        if (nextMi < v.moves.length && san === v.moves[nextMi]) {
          setNav({ on: "var", vi: n.vi, mi: nextMi });
          return;
        }
        setVariations((prev) =>
          prev.map((vv, i) =>
            i === n.vi
              ? { ...vv, moves: [...vv.moves.slice(0, nextMi), san] }
              : vv
          )
        );
        setNav({ on: "var", vi: n.vi, mi: nextMi });
      }
    },
    [gameMoves]
  );

  const playMoves = useCallback(
    (sans: string[]) => {
      if (sans.length === 0) return;
      const n = navRef.current;
      const vars = variationsRef.current;

      if (n.on === "main") {
        let matchCount = 0;
        while (
          matchCount < sans.length &&
          n.index + matchCount < gameMoves.length
        ) {
          if (sans[matchCount] === gameMoves[n.index + matchCount])
            matchCount++;
          else break;
        }
        if (matchCount === sans.length) {
          setNav({ on: "main", index: n.index + sans.length });
          return;
        }
        const branchAt = n.index + matchCount;
        const varMoves = sans.slice(matchCount);
        const existing = vars.findIndex(
          (v) => v.from === branchAt && v.moves[0] === varMoves[0]
        );
        if (existing >= 0) {
          setVariations((prev) => {
            const updated = prev.map((vv, i) =>
              i === existing && varMoves.length > vv.moves.length
                ? { ...vv, moves: varMoves }
                : vv
            );
            const atExisting = updated[existing];
            const mi =
              atExisting !== undefined
                ? Math.min(varMoves.length, atExisting.moves.length) - 1
                : 0;
            setNav({
              on: "var",
              vi: existing,
              mi,
            });
            return updated;
          });
        } else {
          setVariations((prev) => {
            const newVi = prev.length;
            setNav({ on: "var", vi: newVi, mi: varMoves.length - 1 });
            return [...prev, { from: branchAt, moves: varMoves }];
          });
        }
      } else {
        if (!vars[n.vi]) return;
        const nextMi = n.mi + 1;
        setVariations((prev) =>
          prev.map((vv, i) =>
            i === n.vi
              ? { ...vv, moves: [...vv.moves.slice(0, nextMi), ...sans] }
              : vv
          )
        );
        setNav({ on: "var", vi: n.vi, mi: nextMi + sans.length - 1 });
      }
    },
    [gameMoves]
  );

  const onPieceDrag = useCallback(
    ({
      square,
    }: {
      isSparePiece: boolean;
      piece: { pieceType: string };
      square: string | null;
    }) => {
      if (!square) {
        setSelectedSquare(null);
        return;
      }
      const piece = displayedGame.get(square as Square);
      if (!piece || piece.color !== displayedGame.turn()) {
        setSelectedSquare(null);
        return;
      }
      setSelectedSquare(square);
    },
    [displayedGame]
  );

  const onPieceClick = useCallback(
    ({
      square,
    }: {
      isSparePiece: boolean;
      piece: { pieceType: string };
      square: string | null;
    }) => {
      if (!square) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare && selectedSquare !== square) {
        const targets = getLegalMovesForSquare(selectedSquare);
        if (targets.includes(square)) {
          const game = new Chess(currentFen);
          const isPawn = game.get(selectedSquare as Square)?.type === "p";
          const isPromoRank = square[1] === "8" || square[1] === "1";
          const move = game.move(
            isPawn && isPromoRank
              ? { from: selectedSquare, to: square, promotion: "q" }
              : { from: selectedSquare, to: square }
          );
          if (move) {
            playMove(move.san);
            setSelectedSquare(null);
            return;
          }
        }
      }

      const piece = displayedGame.get(square as Square);
      if (!piece || piece.color !== displayedGame.turn()) {
        setSelectedSquare(null);
        return;
      }
      setSelectedSquare(square === selectedSquare ? null : square);
    },
    [displayedGame, selectedSquare, getLegalMovesForSquare, currentFen, playMove]
  );

  const onSquareClick = useCallback(
    ({
      square,
    }: { piece: { pieceType: string } | null; square: string }) => {
      if (!selectedSquare) return;
      const targets = getLegalMovesForSquare(selectedSquare);
      if (targets.includes(square)) {
        const game = new Chess(currentFen);
        const isPawn = game.get(selectedSquare as Square)?.type === "p";
        const isPromoRank = square[1] === "8" || square[1] === "1";
        const move = game.move(
          isPawn && isPromoRank
            ? { from: selectedSquare, to: square, promotion: "q" }
            : { from: selectedSquare, to: square }
        );
        if (move) {
          playMove(move.san);
          setSelectedSquare(null);
        }
      } else {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, getLegalMovesForSquare, currentFen, playMove]
  );

  const handleDrop = useCallback(
    ({
      piece,
      sourceSquare,
      targetSquare,
    }: {
      piece: { pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare) return false;
      try {
        const game = new Chess(currentFen);
        const isPawn = piece.pieceType.toLowerCase().endsWith("p");
        const isPromoRank = targetSquare[1] === "8" || targetSquare[1] === "1";
        const move = game.move(
          isPawn && isPromoRank
            ? { from: sourceSquare, to: targetSquare, promotion: "q" }
            : { from: sourceSquare, to: targetSquare }
        );
        if (!move) return false;
        setSelectedSquare(null);
        playMove(move.san);
        return true;
      } catch {
        return false;
      }
    },
    [currentFen, playMove]
  );

  /* ---- navigation ---- */

  const goToMain = useCallback(
    (index: number) => {
      setNav({
        on: "main",
        index: Math.max(0, Math.min(gameMoves.length, index)),
      });
    },
    [gameMoves.length]
  );

  const goToVar = useCallback((vi: number, mi: number) => {
    setNav({ on: "var", vi, mi });
  }, []);

  const goBack = useCallback(() => {
    const n = navRef.current;
    const vars = variationsRef.current;
    if (n.on === "main") {
      if (n.index > 0) setNav({ on: "main", index: n.index - 1 });
    } else {
      if (n.mi > 0) setNav({ on: "var", vi: n.vi, mi: n.mi - 1 });
      else {
        const v = vars[n.vi];
        setNav({ on: "main", index: v ? v.from : 0 });
      }
    }
  }, []);

  const goForward = useCallback(() => {
    const n = navRef.current;
    const vars = variationsRef.current;
    if (n.on === "main") {
      if (n.index < gameMoves.length)
        setNav({ on: "main", index: n.index + 1 });
    } else {
      const v = vars[n.vi];
      if (v && n.mi < v.moves.length - 1)
        setNav({ on: "var", vi: n.vi, mi: n.mi + 1 });
    }
  }, [gameMoves.length]);

  const goToStart = useCallback(() => {
    setNav({ on: "main", index: 0 });
  }, []);

  const goToEnd = useCallback(() => {
    const n = navRef.current;
    const vars = variationsRef.current;
    if (n.on === "main") {
      setNav({ on: "main", index: gameMoves.length });
    } else {
      const v = vars[n.vi];
      if (v) setNav({ on: "var", vi: n.vi, mi: v.moves.length - 1 });
    }
  }, [gameMoves.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToStart();
      } else if (e.key === "End") {
        e.preventDefault();
        goToEnd();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goBack, goForward, goToStart, goToEnd]);

  useEffect(() => {
    setSelectedSquare(null);
  }, [nav]);

  /* ---- eval ---- */

  const gameEval =
    nav.on === "main" ? evals[nav.index] : undefined;
  const pvScore = pvLines[0]?.score;
  const currentScore = gameEval?.score ?? pvScore ?? 0;

  /* ---- board annotation glyph ---- */

  const boardAnnotation = useMemo(() => {
    if (!lastMoveSquares || !gameEval?.classification) return null;
    return {
      square: lastMoveSquares.to,
      classification: gameEval.classification,
      color: CLASSIFICATION_COLORS[gameEval.classification],
    };
  }, [lastMoveSquares, gameEval]);

  const renderSquare = useCallback(
    ({ square, children }: { piece: { pieceType: string } | null; square: string; children?: React.ReactNode }) => {
      if (!boardAnnotation || square !== boardAnnotation.square) return null as unknown as React.JSX.Element;
      return (
        <div style={{ width: "100%", height: "100%", position: "relative", ...highlightStyles[square] }}>
          {children}
          <div
            className={styles["boardGlyph"]}
            style={{ backgroundColor: boardAnnotation.color }}
          >
            <AnnotationContent classification={boardAnnotation.classification} iconSize={22} />
          </div>
        </div>
      );
    },
    [boardAnnotation, highlightStyles]
  );

  /* ---- variations grouped by branch point ---- */

  const varsByBranch = useMemo(() => {
    const map = new Map<number, { vi: number; v: Variation }[]>();
    variations.forEach((v, vi) => {
      const list = map.get(v.from) ?? [];
      list.push({ vi, v });
      map.set(v.from, list);
    });
    return map;
  }, [variations]);

  /* ---- active check helpers ---- */

  const isMainActive = (posIndex: number) =>
    nav.on === "main" && nav.index === posIndex;

  const isVarMoveActive = (vi: number, mi: number) =>
    nav.on === "var" && nav.vi === vi && nav.mi === mi;

  if (loading) {
    return (
      <div className={styles["empty"]}>
        <p>{t("analysis.loadingGame")}</p>
      </div>
    );
  }

  if (!gameData || gameMoves.length === 0) {
    return (
      <div className={styles["empty"]}>
        <p>{t("analysis.noGame")}</p>
        <button type="button" onClick={() => navigate("/")}>{t("analysis.backHome")}</button>
      </div>
    );
  }

  const topPlayer = orientation === "white" ? playerBlack : playerWhite;
  const bottomPlayer = orientation === "white" ? playerWhite : playerBlack;
  const topMaterial: SideMaterial =
    orientation === "white" ? materialDiff.black : materialDiff.white;
  const bottomMaterial: SideMaterial =
    orientation === "white" ? materialDiff.white : materialDiff.black;

  /* ---- build move list with inline variations ---- */

  const moveListElements: React.ReactNode[] = [];
  for (let i = 0; i < gameMoves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteIdx = i + 1;
    const blackIdx = i + 2;
    const whiteSan = gameMoves[i];
    if (whiteSan === undefined) break;
    const blackSan = gameMoves[i + 1];
    const whiteEntry = evals[whiteIdx];
    const blackEntry = blackSan ? evals[blackIdx] : undefined;

    moveListElements.push(
      <div key={`m${i}`} className={styles["movePair"]}>
        <span className={styles["moveNum"]}>{moveNum}.</span>
        <MainMoveCell
          san={whiteSan}
          {...(whiteEntry?.classification !== undefined
            ? { classification: whiteEntry.classification }
            : {})}
          active={isMainActive(whiteIdx)}
          onClick={() => goToMain(whiteIdx)}
        />
        {blackSan ? (
          <MainMoveCell
            san={blackSan}
            {...(blackEntry?.classification !== undefined
              ? { classification: blackEntry.classification }
              : {})}
            active={isMainActive(blackIdx)}
            onClick={() => goToMain(blackIdx)}
          />
        ) : (
          <span />
        )}
      </div>
    );

    const afterWhiteVars = varsByBranch.get(whiteIdx);
    if (afterWhiteVars) {
      for (const { vi, v } of afterWhiteVars) {
        moveListElements.push(
          <VariationLine
            key={`v${vi}`}
            variation={v}
            vi={vi}
            nav={nav}
            isVarMoveActive={isVarMoveActive}
            goToVar={goToVar}
          />
        );
      }
    }

    if (blackSan) {
      const afterBlackVars = varsByBranch.get(blackIdx);
      if (afterBlackVars) {
        for (const { vi, v } of afterBlackVars) {
          moveListElements.push(
            <VariationLine
              key={`v${vi}`}
              variation={v}
              vi={vi}
              nav={nav}
              isVarMoveActive={isVarMoveActive}
              goToVar={goToVar}
            />
          );
        }
      }
    }
  }

  const endVars = varsByBranch.get(gameMoves.length);
  if (endVars) {
    for (const { vi, v } of endVars) {
      moveListElements.push(
        <VariationLine
          key={`v${vi}`}
          variation={v}
          vi={vi}
          nav={nav}
          isVarMoveActive={isVarMoveActive}
          goToVar={goToVar}
        />
      );
    }
  }

  return (
    <div className={styles["container"]}>
      <NavBar
        displayName={displayName}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />

      <main className={styles["main"]}>
        <div className={styles["boardSection"]} dir="ltr">
          <div className={styles["playerBar"]}>
            <span className={styles["playerBarName"]}>{topPlayer}</span>
            {showMaterial && <MaterialDisplay material={topMaterial} />}
          </div>

          <div className={styles["boardRow"]}>
            <div className={styles["evalColumn"]}>
              <EvalBar score={currentScore} orientation={orientation} />
              <span className={styles["evalScore"]}>
                {currentScore >= 0 ? "+" : "\u2212"}
                {formatEvalLabel(currentScore)}
              </span>
            </div>
            <div className={styles["board"]}>
              <Chessboard
                options={{
                  ...(boardPrefs.customPieces
                    ? { pieces: boardPrefs.customPieces }
                    : {}),
                  position: currentFen,
                  boardOrientation: orientation,
                  squareStyles: highlightStyles,
                  onPieceDrop: handleDrop,
                  onPieceDrag: onPieceDrag,
                  onPieceClick: onPieceClick,
                  onSquareClick: onSquareClick,
                  squareRenderer: renderSquare,
                  arrows: hoverArrow
                    ? [
                        {
                          startSquare: hoverArrow.from,
                          endSquare: hoverArrow.to,
                          color: "rgba(0, 120, 0, 0.8)",
                        },
                      ]
                    : [],
                  animationDurationInMs: 150,
                  boardStyle: {
                    borderRadius: "0",
                  },
                  darkSquareStyle: boardPrefs.darkSquareStyle,
                  lightSquareStyle: boardPrefs.lightSquareStyle,
                  darkSquareNotationStyle: boardPrefs.darkSquareNotationStyle,
                  lightSquareNotationStyle: boardPrefs.lightSquareNotationStyle,
                  alphaNotationStyle: {
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "12px",
                    fontWeight: 600,
                    position: "absolute" as const,
                    bottom: "2px",
                    right: "4px",
                    lineHeight: 1,
                    userSelect: "none" as const,
                    pointerEvents: "none" as const,
                  },
                  numericNotationStyle: {
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "12px",
                    fontWeight: 600,
                    position: "absolute" as const,
                    top: "2px",
                    left: "4px",
                    lineHeight: 1,
                    userSelect: "none" as const,
                    pointerEvents: "none" as const,
                  },
                }}
              />
            </div>
          </div>

          <div className={styles["playerBar"]}>
            <span className={styles["playerBarName"]}>{bottomPlayer}</span>
            {showMaterial && <MaterialDisplay material={bottomMaterial} />}
          </div>

          <div className={styles["graphArea"]}>
            <ScoreGraph
              evals={evals}
              currentIndex={
                nav.on === "main"
                  ? nav.index
                  : Math.min(variations[nav.vi]?.from ?? 0, gameMoves.length)
              }
              onSelectIndex={goToMain}
            />
          </div>

          <div
            className={styles["fenBar"]}
            onClick={() => navigator.clipboard?.writeText(currentFen)}
            title={t("analysis.copyFen")}
          >
            {currentFen}
          </div>

          <div className={styles["navButtons"]}>
            <button type="button" onClick={goToStart} title={t("analysis.navFirst")}>
              &laquo;
            </button>
            <button type="button" onClick={goBack} title={t("analysis.navPrev")}>
              &lsaquo;
            </button>
            <button type="button" onClick={goForward} title={t("analysis.navNext")}>
              &rsaquo;
            </button>
            <button type="button" onClick={goToEnd} title={t("analysis.navLast")}>
              &raquo;
            </button>
          </div>
        </div>

        <div className={styles["sidebar"]}>
          {analyzing && (
            <div className={styles["progressBar"]}>
              <div className={styles["progressLabel"]}>
                {t("analysis.analyzing", { p: String(progress) })}
              </div>
              <div className={styles["progressTrack"]}>
                <div
                  className={styles["progressFill"]}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className={styles["engineLines"]}>
            <h3 className={styles["engineLinesTitle"]}>
              {t("analysis.engineLines")}
              {pvLines.length > 0 && (
                <span className={styles["engineDepth"]}>
                  d{pvLines[0]?.depth}
                </span>
              )}
              {pvComputing && <span className={styles["engineSpinner"]} />}
            </h3>
            {pvLines.length > 0 ? (
              <div className={styles["engineLinesList"]}>
                {pvLines.map((pv) => (
                  <div
                    key={pv.rank}
                    className={styles["engineLine"]}
                    onMouseLeave={() => setHoverArrow(null)}
                  >
                    <span
                      className={`${styles["engineLineScore"]} ${pv.score >= 0 ? styles["engineLineWhite"] : styles["engineLineBlack"]}`}
                    >
                      {pv.mate !== null
                        ? `${pv.mate > 0 ? "+" : "\u2212"}M${Math.abs(pv.mate)}`
                        : `${pv.score >= 0 ? "+" : "\u2212"}${(Math.abs(pv.score) / 100).toFixed(1)}`}
                    </span>
                    <span className={styles["engineLineMoves"]}>
                      {pv.san.map((move, mi) => (
                        <span
                          key={mi}
                          className={styles["pvMove"]}
                          {...(mi === 0 && pv.firstMove
                            ? {
                                onMouseEnter: () => {
                                  const fm = pv.firstMove;
                                  if (fm) setHoverArrow(fm);
                                },
                              }
                            : {})}
                          onClick={() => playMoves(pv.san.slice(0, mi + 1))}
                        >
                          {move}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles["engineLinesEmpty"]}>
                {pvComputing ? t("analysis.calculating") : t("analysis.noLines")}
              </div>
            )}
          </div>

          {movesTruncated && (
            <div className={styles["truncationWarning"]}>
              {t("analysis.truncationBanner", { n: String(gameMoves.length) })}
            </div>
          )}

          <div className={styles["movesPanel"]}>
            <h3 className={styles["movesTitle"]}>{t("analysis.moves")}</h3>
            <div className={styles["movesList"]}>{moveListElements}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---- sub-components ---- */

function MainMoveCell({
  san,
  classification,
  active,
  onClick,
}: {
  san: string;
  classification?: MoveClassification;
  active: boolean;
  onClick: () => void;
}) {
  const color = classification
    ? CLASSIFICATION_COLORS[classification]
    : undefined;

  return (
    <span
      className={`${styles["moveCell"]} ${active ? styles["moveCellActive"] : ""}`}
      onClick={onClick}
    >
      {san}
      {classification && color && (
        <span
          className={styles["annotationGlyph"]}
          style={{ backgroundColor: color }}
        >
          <AnnotationContent classification={classification} iconSize={16} />
        </span>
      )}
    </span>
  );
}

function VariationLine({
  variation,
  vi,
  nav: _nav,
  isVarMoveActive,
  goToVar,
}: {
  variation: Variation;
  vi: number;
  nav: Nav;
  isVarMoveActive: (vi: number, mi: number) => boolean;
  goToVar: (vi: number, mi: number) => void;
}) {
  const startPly = variation.from;
  const isBlackFirst = startPly % 2 === 1;

  return (
    <div className={styles["variationRow"]}>
      <span className={styles["variationMoves"]}>
        {variation.moves.map((san, mi) => {
          const ply = startPly + mi;
          const isBlack = ply % 2 === 1;
          const moveNum = Math.floor(ply / 2) + 1;
          const showNum = mi === 0 || !isBlack;
          const active = isVarMoveActive(vi, mi);

          return (
            <span key={mi}>
              {showNum && (
                <span className={styles["varMoveNum"]}>
                  {moveNum}.{mi === 0 && isBlackFirst ? ".." : ""}
                </span>
              )}
              <span
                className={`${styles["varMove"]} ${active ? styles["varMoveActive"] : ""}`}
                onClick={() => goToVar(vi, mi)}
              >
                {san}
              </span>{" "}
            </span>
          );
        })}
      </span>
    </div>
  );
}
