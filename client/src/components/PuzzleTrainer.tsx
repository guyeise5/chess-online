import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import PromotionDialog from "./PromotionDialog";
import { computeMaterialDiff, type SideMaterial } from "../utils/materialDiff";
import MaterialDisplay from "./MaterialDisplay";
import NavBar from "./NavBar";
import { BLINDFOLD_PIECES } from "../boardThemes";
import { getEnv } from "../types";
import { playMoveSound } from "../utils/sounds";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import { useUserPrefs } from "../hooks/useUserPreferences";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./PuzzleTrainer.module.css";

const DEFAULT_RATING = 1500;
const MIN_RATING = 100;
const API_BASE = import.meta.env.PROD ? "" : "http://localhost:3001";

interface PuzzleData {
  puzzleId: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

type PuzzleStatus = "loading" | "showing" | "solving" | "correct" | "failed";

function getKFactor(puzzlesPlayed: number): number {
  if (puzzlesPlayed < 10) return 40;
  if (puzzlesPlayed < 30) return 30;
  if (puzzlesPlayed < 100) return 20;
  return 12;
}

function expectedScore(playerRating: number, puzzleRating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - playerRating) / 400));
}

function computeRatingChange(
  playerRating: number,
  puzzleRating: number,
  solved: boolean,
  puzzlesPlayed: number
): number {
  const k = getKFactor(puzzlesPlayed);
  const expected = expectedScore(playerRating, puzzleRating);
  const actual = solved ? 1 : 0;
  return Math.round(k * (actual - expected));
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

interface PuzzleTrainerProps {
  boardPrefs: BoardPreferences;
  onOpenSettings?: () => void;
}

export default function PuzzleTrainer({ boardPrefs, onOpenSettings }: PuzzleTrainerProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { puzzleId: urlPuzzleId } = useParams<{ puzzleId?: string }>();
  const { prefs: userPrefs, update: updatePrefs } = useUserPrefs();
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState("start");
  const [status, setStatus] = useState<PuzzleStatus>("loading");
  const [playerRating, setPlayerRating] = useState(() =>
    Number.isFinite(userPrefs.puzzleRating) ? userPrefs.puzzleRating : DEFAULT_RATING
  );
  const [, setPuzzleCount] = useState(() =>
    Number.isFinite(userPrefs.puzzleCount) ? userPrefs.puzzleCount : 0
  );
  const [moveIndex, setMoveIndex] = useState(0);
  const [playedMoves, setPlayedMoves] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const movesEndRef = useRef<HTMLDivElement>(null);

  const statusRef = useRef(status);
  statusRef.current = status;
  const gameRef = useRef(game);
  gameRef.current = game;
  const orientationRef = useRef<"white" | "black">("white");

  const orientation = useMemo(() => {
    if (!puzzle) return "white" as const;
    const g = new Chess(puzzle.fen);
    return g.turn() === "w" ? "black" : "white";
  }, [puzzle]);
  orientationRef.current = orientation;

  const fetchPuzzle = useCallback(async (specificId?: string) => {
    setStatus("loading");
    setPlayedMoves([]);
    setSelectedSquare(null);
    setLastMove(null);
    setHasFailed(false);
    setWrongFlash(false);
    setHintLevel(0);
    setPendingPromotion(null);
    setMoveIndex(0);

    try {
      const url = specificId
        ? `${API_BASE}/api/puzzles/${specificId}`
        : `${API_BASE}/api/puzzles/random?rating=${playerRating}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PuzzleData = await res.json();
      if (!data || !Array.isArray(data.moves) || data.moves.length === 0 || typeof data.fen !== "string") {
        console.error("Invalid puzzle data");
        return;
      }
      setPuzzle(data);

      if (!specificId || specificId !== data.puzzleId) {
        navigate(`/puzzles/${data.puzzleId}`, { replace: true });
      }

      const g = new Chess(data.fen);
      const opponentMove = data.moves[0];
      if (!opponentMove) return;
      const from = opponentMove.slice(0, 2);
      const to = opponentMove.slice(2, 4);
      const promotion = opponentMove.length > 4 ? opponentMove[4] : undefined;

      setGame(new Chess(data.fen));
      setFen(data.fen);
      setStatus("showing");

      setTimeout(() => {
        const m = g.move({ from, to, ...(promotion ? { promotion } : {}) });
        if (!m) return;
        setGame(g);
        setFen(g.fen());
        setMoveIndex(1);
        setPlayedMoves([m.san]);
        setLastMove({ from, to });
        playMoveSound(m.san);
        setTimeout(() => setStatus("solving"), 500);
      }, 800);
    } catch (err) {
      console.error("Failed to fetch puzzle:", err);
    }
  }, [navigate]);

  useEffect(() => {
    fetchPuzzle(urlPuzzleId);
  }, []);

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playedMoves]);

  const isPromotionMove = useCallback(
    (from: string, to: string): boolean => {
      const piece = game.get(from as Square);
      if (!piece || piece.type !== "p") return false;
      const turn = game.turn();
      return (turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1");
    },
    [game]
  );

  const tryMove = useCallback(
    (from: string, to: string, chosenPromotion?: string): boolean => {
      if (status !== "solving" || !puzzle) return false;

      if (!chosenPromotion && isPromotionMove(from, to)) {
        setPendingPromotion({ from, to });
        setSelectedSquare(null);
        return false;
      }

      const promotion = chosenPromotion || undefined;

      try {
        const testGame = new Chess(game.fen());
        testGame.move({ from, to, promotion: promotion || "q" });
      } catch {
        return false;
      }

      const expectedUci = puzzle.moves[moveIndex];
      if (!expectedUci) return false;

      const expectedFrom = expectedUci.slice(0, 2);
      const expectedTo = expectedUci.slice(2, 4);
      const expectedPromo = expectedUci.length > 4 ? expectedUci[4] : undefined;

      if (from !== expectedFrom || to !== expectedTo || (expectedPromo && promotion !== expectedPromo)) {
        if (!hasFailed) {
          setPuzzleCount((prev) => {
            const count = prev + 1;
            const delta = computeRatingChange(playerRating, puzzle.rating, false, count);
            const newRating = Math.max(MIN_RATING, playerRating + delta);
            setPlayerRating(newRating);
            updatePrefs({ puzzleRating: newRating, puzzleCount: count });
            return count;
          });
          setHasFailed(true);
        }
        setWrongFlash(true);
        setTimeout(() => setWrongFlash(false), 600);
        setSelectedSquare(null);
        return false;
      }

      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from, to, ...(promotion ? { promotion } : {}) });
      if (!move) return false;

      setGame(gameCopy);
      setFen(gameCopy.fen());
      setSelectedSquare(null);
      setPendingPromotion(null);
      setLastMove({ from, to });
      setHintLevel(0);
      setPlayedMoves((prev) => [...prev, move.san]);
      playMoveSound(move.san);

      const nextIndex = moveIndex + 1;

      if (nextIndex >= puzzle.moves.length) {
        if (!hasFailed) {
          setPuzzleCount((prev) => {
            const count = prev + 1;
            const delta = computeRatingChange(playerRating, puzzle.rating, true, count);
            const newRating = Math.max(MIN_RATING, playerRating + delta);
            setPlayerRating(newRating);
            updatePrefs({ puzzleRating: newRating, puzzleCount: count });
            return count;
          });
        }
        setStatus("correct");
        setMoveIndex(nextIndex);
        return true;
      }

      const replyUci = puzzle.moves[nextIndex];
      if (!replyUci) {
        setMoveIndex(nextIndex);
        return true;
      }
      const replyFrom = replyUci.slice(0, 2);
      const replyTo = replyUci.slice(2, 4);
      const replyPromo = replyUci.length > 4 ? replyUci[4] : undefined;

      setTimeout(() => {
        const afterReply = new Chess(gameCopy.fen());
        const replyMove = afterReply.move({
          from: replyFrom,
          to: replyTo,
          ...(replyPromo ? { promotion: replyPromo } : {}),
        });
        if (replyMove) {
          setGame(afterReply);
          setFen(afterReply.fen());
          setLastMove({ from: replyFrom, to: replyTo });
          setPlayedMoves((prev) => [...prev, replyMove.san]);
          playMoveSound(replyMove.san);
          setMoveIndex(nextIndex + 1);
        }
      }, 600);

      setMoveIndex(nextIndex);
      return true;
    },
    [status, puzzle, moveIndex, game, playerRating, hasFailed, isPromotionMove]
  );

  const showSolution = useCallback(() => {
    if (!puzzle) return;
    setStatus("failed");
    setSelectedSquare(null);

    const remaining = puzzle.moves.slice(moveIndex);
    let g = new Chess(game.fen());
    let delay = 0;

    for (const uci of remaining) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promo = uci.length > 4 ? uci[4] : undefined;
      const snapshot = new Chess(g.fen());
      const move = snapshot.move({ from, to, ...(promo ? { promotion: promo } : {}) });
      if (!move) break;
      const newFen = snapshot.fen();
      const san = move.san;
      g = snapshot;

      setTimeout(() => {
        setGame(new Chess(newFen));
        setFen(newFen);
        setLastMove({ from, to });
        setPlayedMoves((prev) => [...prev, san]);
        playMoveSound(san);
      }, delay);
      delay += 600;
    }
  }, [puzzle, moveIndex, game]);

  const getLegalMovesForSquare = useCallback(
    (square: string): string[] => {
      try {
        return game
          .moves({ square: square as Square, verbose: true })
          .map((m) => m.to);
      } catch {
        return [];
      }
    },
    [game]
  );

  const HIGHLIGHT_SOURCE: React.CSSProperties = {
    backgroundColor: "rgba(255, 255, 0, 0.4)",
  };
  const HIGHLIGHT_DOT: React.CSSProperties = {
    background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
  };
  const HIGHLIGHT_CAPTURE: React.CSSProperties = {
    background: "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)",
  };
  const HIGHLIGHT_LAST_MOVE: React.CSSProperties = {
    backgroundColor: "rgba(155, 199, 0, 0.41)",
  };
  const HIGHLIGHT_HINT: React.CSSProperties = {
    backgroundColor: "rgba(96, 165, 250, 0.5)",
  };
  const HIGHLIGHT_CHECK: React.CSSProperties = {
    background: "radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,76,60,0.5) 40%, rgba(169,32,32,0.15) 70%, transparent 100%)",
  };

  const hintSquare = useMemo(() => {
    if (hintLevel === 0 || !puzzle || status !== "solving") return null;
    const uci = puzzle.moves[moveIndex];
    if (!uci) return null;
    return uci.slice(0, 2);
  }, [hintLevel, puzzle, moveIndex, status]);

  const hintArrow = useMemo(() => {
    if (hintLevel < 2 || !puzzle || status !== "solving") return [];
    const uci = puzzle.moves[moveIndex];
    if (!uci) return [];
    return [{ startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color: "rgba(96, 165, 250, 0.8)" }];
  }, [hintLevel, puzzle, moveIndex, status]);

  const highlightStyles = useMemo((): Record<string, React.CSSProperties> => {
    const result: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      result[lastMove.from] = HIGHLIGHT_LAST_MOVE;
      result[lastMove.to] = HIGHLIGHT_LAST_MOVE;
    }

    if (game.inCheck()) {
      const kingSq = findKingSquare(game);
      if (kingSq) result[kingSq] = HIGHLIGHT_CHECK;
    }

    if (hintSquare) {
      result[hintSquare] = HIGHLIGHT_HINT;
    }

    if (selectedSquare) {
      result[selectedSquare] = HIGHLIGHT_SOURCE;
      const targets = getLegalMovesForSquare(selectedSquare);
      for (const sq of targets) {
        const pieceOnTarget = game.get(sq as Square);
        result[sq] = pieceOnTarget ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT;
      }
    }

    return result;
  }, [selectedSquare, lastMove, hintSquare, game, getLegalMovesForSquare]);

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }): boolean => {
      setSelectedSquare(null);
      if (!targetSquare || status !== "solving") return false;
      return tryMove(sourceSquare, targetSquare);
    },
    [tryMove, status]
  );

  const onPieceDrag = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (!square || statusRef.current !== "solving") { setSelectedSquare(null); return; }
      const piece = gameRef.current.get(square as Square);
      if (!piece) { setSelectedSquare(null); return; }
      const myColor = orientationRef.current === "white" ? "w" : "b";
      if (piece.color !== myColor) { setSelectedSquare(null); return; }
      setSelectedSquare(square);
    },
    []
  );

  const onPieceClick = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (!square || status !== "solving") { setSelectedSquare(null); return; }

      if (selectedSquare && selectedSquare !== square) {
        const targets = getLegalMovesForSquare(selectedSquare);
        if (targets.includes(square)) {
          tryMove(selectedSquare, square);
          return;
        }
      }

      const piece = game.get(square as Square);
      if (!piece) { setSelectedSquare(null); return; }
      const myColor = orientation === "white" ? "w" : "b";
      if (piece.color !== myColor) { setSelectedSquare(null); return; }
      setSelectedSquare(square === selectedSquare ? null : square);
    },
    [game, selectedSquare, status, orientation, getLegalMovesForSquare, tryMove]
  );

  const onSquareClick = useCallback(
    ({ square }: { piece: { pieceType: string } | null; square: string }) => {
      if (!selectedSquare) return;
      const targets = getLegalMovesForSquare(selectedSquare);
      if (targets.includes(square)) {
        tryMove(selectedSquare, square);
      } else {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, getLegalMovesForSquare, tryMove]
  );

  const materialDiff = useMemo(() => computeMaterialDiff(game), [game]);
  const isPlayerWhite = orientation === "white";
  const topMaterial: SideMaterial = isPlayerWhite ? materialDiff.black : materialDiff.white;
  const bottomMaterial: SideMaterial = isPlayerWhite ? materialDiff.white : materialDiff.black;
  const showMaterial = getEnv().FEATURE_MATERIAL_DIFF !== "false";

  if (status === "loading" || !puzzle) {
    return <div className={styles['loading']}>{t("puzzle.loading")}</div>;
  }

  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < playedMoves.length; i += 2) {
    const black = playedMoves[i + 1];
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: playedMoves[i] ?? "",
      ...(black !== undefined ? { black } : {}),
    });
  }

  return (
    <div className={styles['container']}>
      <NavBar {...(onOpenSettings ? { onOpenSettings } : {})} />

      <main className={styles['main']}>
        <div className={styles['boardArea']} dir="ltr">
          <div className={styles['playerBar']}>
            <span className={styles['playerBarName']}>{isPlayerWhite ? t("puzzle.black") : t("puzzle.white")}</span>
            {showMaterial && <MaterialDisplay material={topMaterial} />}
          </div>
          <div className={styles['board']} style={{ position: "relative" }}>
            {pendingPromotion && (
              <PromotionDialog
                color={orientation}
                square={pendingPromotion.to}
                orientation={orientation}
                onSelect={(piece) => tryMove(pendingPromotion.from, pendingPromotion.to, piece)}
                onCancel={() => setPendingPromotion(null)}
              />
            )}
            <Chessboard
              options={{
                ...(boardPrefs.piecesName === BLINDFOLD_PIECES
                  ? {}
                  : boardPrefs.customPieces
                    ? { pieces: boardPrefs.customPieces }
                    : {}),
                position: fen,
                onPieceDrop: onDrop,
                onPieceDrag: onPieceDrag,
                onPieceClick: onPieceClick,
                onSquareClick: onSquareClick,
                canDragPiece: ({ piece }) => {
                  if (statusRef.current !== "solving") return false;
                  const myColor = orientationRef.current === "white" ? "w" : "b";
                  return piece.pieceType[0] === myColor;
                },
                squareStyles: highlightStyles,
                arrows: hintArrow,
                boardOrientation: orientation,
                animationDurationInMs: 200,
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
          <div className={styles['playerBar']}>
            <span className={styles['playerBarName']}>{isPlayerWhite ? t("puzzle.white") : t("puzzle.black")}</span>
            {showMaterial && <MaterialDisplay material={bottomMaterial} />}
          </div>
        </div>

        <div className={styles['sidebar']}>
          <div className={styles['playerRating']}>
            <span className={styles['label']}>{t("puzzle.yourRating")}</span>
            <span className={styles['value']}>{playerRating}</span>
          </div>

          <div
            className={`${styles['statusBanner']} ${
              status === "showing" || status === "solving"
                ? wrongFlash
                  ? styles['statusWrong']
                  : hasFailed
                  ? styles['statusRetry']
                  : styles['statusSolving']
                : status === "correct"
                ? hasFailed
                  ? styles['statusRetry']
                  : styles['statusCorrect']
                : styles['statusFailed']
            }`}
          >
            {status === "showing" && t("puzzle.opponentPlaying")}
            {status === "solving" &&
              (wrongFlash
                ? t("puzzle.tryAgain")
                : hasFailed
                ? t("puzzle.keepTrying")
                : t("puzzle.findBestFor", {
                    color: orientation === "white" ? t("puzzle.white") : t("puzzle.black"),
                  }))}
            {status === "correct" &&
              (hasFailed
                ? t("puzzle.solved")
                : t("puzzle.correctWell"))}
            {status === "failed" && t("puzzle.solutionLabel")}
          </div>

          {(status === "correct" || status === "failed") && (
            <div className={styles['puzzleInfo']}>
              <div className={styles['puzzleRating']}>
                <span>{t("puzzle.rating")}</span>
                <span>{puzzle.rating}</span>
              </div>
              {puzzle.themes.length > 0 && (
                <div className={styles['themes']}>
                  {puzzle.themes.map((t) => (
                    <span key={t} className={styles['theme']}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles['movesPanel']}>
            <h3 className={styles['movesTitle']}>{t("game.moves")}</h3>
            <div className={styles['movesList']}>
              {movePairs.map((mp) => (
                <div key={mp.num} className={styles['movePair']}>
                  <span className={styles['moveNum']}>{mp.num}.</span>
                  <span className={styles['moveWhite']}>{mp.white}</span>
                  <span className={styles['moveBlack']}>{mp.black || ""}</span>
                </div>
              ))}
              <div ref={movesEndRef} />
            </div>
          </div>

          {status === "solving" && (
            <div className={styles['hintRow']}>
              {hintLevel < 2 && (
                <button
                  className={styles['hintBtn']}
                  onClick={() => {
                    if (!hasFailed && puzzle) {
                      setPuzzleCount((prev) => {
                        const count = prev + 1;
                        const delta = computeRatingChange(playerRating, puzzle.rating, false, count);
                        const newRating = Math.max(MIN_RATING, playerRating + delta);
                        setPlayerRating(newRating);
                        updatePrefs({ puzzleRating: newRating, puzzleCount: count });
                        return count;
                      });
                      setHasFailed(true);
                    }
                    setHintLevel((prev) => prev + 1);
                  }}
                >
                  {hintLevel === 0 ? t("puzzle.hintPiece") : t("puzzle.hintMove")}
                </button>
              )}
              {hasFailed && (
                <button type="button" className={styles['showSolutionBtn']} onClick={showSolution}>
                  {t("puzzle.showSolution")}
                </button>
              )}
            </div>
          )}

          {(status === "correct" || status === "failed") && (
            <button type="button" className={styles['nextBtn']} onClick={() => fetchPuzzle()}>
              {t("puzzle.next")}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
