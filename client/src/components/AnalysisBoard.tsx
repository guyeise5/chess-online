import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  useStockfishAnalysis,
  type MoveClassification,
} from "../hooks/useStockfishAnalysis";
import useMultiPV from "../hooks/useMultiPV";
import EvalBar, { formatEvalLabel } from "./EvalBar";
import ScoreGraph from "./ScoreGraph";
import styles from "./AnalysisBoard.module.css";

const HIGHLIGHT_LAST_MOVE: React.CSSProperties = {
  backgroundColor: "rgba(155, 199, 0, 0.41)",
};
const HIGHLIGHT_CHECK: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,76,60,0.5) 40%, rgba(169,32,32,0.15) 70%, transparent 100%)",
};

const CLASSIFICATION_SYMBOLS: Record<MoveClassification, string> = {
  best: "!",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  best: "#96bc4b",
  good: "#96bc4b",
  inaccuracy: "#f7c631",
  mistake: "#e68f3c",
  blunder: "#ca3431",
};

export interface AnalysisGameData {
  moves: string[];
  startFen?: string;
  playerWhite?: string;
  playerBlack?: string;
  orientation?: "white" | "black";
}

const ANALYSIS_STORAGE_PREFIX = "chess-analysis-";

export function saveAnalysisGame(gameId: string, data: AnalysisGameData) {
  localStorage.setItem(ANALYSIS_STORAGE_PREFIX + gameId, JSON.stringify(data));
}

function loadAnalysisGame(gameId: string): AnalysisGameData | null {
  try {
    const raw = localStorage.getItem(ANALYSIS_STORAGE_PREFIX + gameId);
    return raw ? JSON.parse(raw) : null;
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
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "k" && piece.color === turn) {
        return piece.square;
      }
    }
  }
  return null;
}

export default function AnalysisBoard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId } = useParams<{ gameId: string }>();
  const routeState = location.state as AnalysisGameData | undefined;

  const gameData = useMemo(() => {
    if (routeState?.moves?.length) return routeState;
    if (gameId) return loadAnalysisGame(gameId);
    return null;
  }, [routeState, gameId]);

  const gameMoves = useMemo(() => gameData?.moves ?? [], [gameData]);
  const startFen = gameData?.startFen;
  const orientation = gameData?.orientation ?? "white";
  const playerWhite = gameData?.playerWhite ?? "White";
  const playerBlack = gameData?.playerBlack ?? "Black";

  const { evals, progress, analyzing, startAnalysis } = useStockfishAnalysis(
    gameMoves,
    startFen
  );

  const [currentIndex, setCurrentIndex] = useState(gameMoves.length);
  const [hoverArrow, setHoverArrow] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [pvPreview, setPvPreview] = useState<string[] | null>(null);

  const currentFen = useMemo(() => {
    const g = new Chess(startFen);
    for (let i = 0; i < currentIndex && i < gameMoves.length; i++) {
      g.move(gameMoves[i]);
    }
    return g.fen();
  }, [startFen, gameMoves, currentIndex]);

  const positions = useMemo(() => {
    const game = new Chess(startFen);
    const fens = [game.fen()];
    for (const san of gameMoves) {
      game.move(san);
      fens.push(game.fen());
    }
    return fens;
  }, [gameMoves, startFen]);

  const previewFen = useMemo(() => {
    if (!pvPreview) return null;
    try {
      const g = new Chess(currentFen);
      for (const san of pvPreview) g.move(san);
      return g.fen();
    } catch {
      return null;
    }
  }, [pvPreview, currentFen]);

  const displayedFen = previewFen ?? positions[currentIndex] ?? positions[0];
  const displayedGame = useMemo(() => new Chess(displayedFen), [displayedFen]);

  const { lines: pvLines, computing: pvComputing } = useMultiPV(
    gameMoves.length > 0 ? displayedFen : null
  );

  const lastMoveSquares = useMemo(() => {
    if (pvPreview && pvPreview.length > 0) {
      try {
        const g = new Chess(currentFen);
        let last: { from: string; to: string } | null = null;
        for (const san of pvPreview) {
          const m = g.move(san);
          if (m) last = { from: m.from, to: m.to };
        }
        return last;
      } catch {
        return null;
      }
    }
    if (currentIndex === 0) return null;
    const g = new Chess(positions[currentIndex - 1]);
    const move = g.move(gameMoves[currentIndex - 1]);
    return move ? { from: move.from, to: move.to } : null;
  }, [positions, gameMoves, currentIndex, pvPreview, currentFen]);

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
    return result;
  }, [lastMoveSquares, displayedGame]);

  useEffect(() => {
    startAnalysis();
  }, [startAnalysis]);

  const goTo = useCallback(
    (index: number) => {
      setPvPreview(null);
      setCurrentIndex(Math.max(0, Math.min(gameMoves.length, index)));
    },
    [gameMoves.length]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPvPreview(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPvPreview(null);
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPvPreview(null);
        setCurrentIndex((i) => Math.min(gameMoves.length, i + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setPvPreview(null);
        setCurrentIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setPvPreview(null);
        setCurrentIndex(gameMoves.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameMoves.length]);

  const currentEval = evals[currentIndex];
  const hasEval = currentEval !== undefined;
  const currentScore = currentEval?.score ?? 0;

  const movePairs: {
    num: number;
    whiteIdx: number;
    white: string;
    blackIdx?: number;
    black?: string;
  }[] = [];
  for (let i = 0; i < gameMoves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      whiteIdx: i + 1,
      white: gameMoves[i],
      blackIdx: i + 1 < gameMoves.length ? i + 2 : undefined,
      black: gameMoves[i + 1],
    });
  }

  if (!gameData || gameMoves.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No game to analyze.</p>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  const topPlayer = orientation === "white" ? playerBlack : playerWhite;
  const bottomPlayer = orientation === "white" ? playerWhite : playerBlack;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          &larr; Back
        </button>
        <h1 className={styles.logo}>
          <img src="/favicon.png" alt="" className={styles.logoIcon} /> Game
          Analysis
        </h1>
        <span className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.boardSection}>
          <div className={styles.playerBar}>
            <span className={styles.playerBarName}>{topPlayer}</span>
          </div>

          <div className={styles.boardRow}>
            <div className={styles.evalColumn}>
              {hasEval ? (
                <>
                  <EvalBar score={currentScore} orientation={orientation} />
                  <span className={styles.evalScore}>
                    {currentScore >= 0 ? "+" : "\u2212"}
                    {formatEvalLabel(currentScore)}
                  </span>
                </>
              ) : (
                <div className={styles.evalPlaceholder} />
              )}
            </div>
            <div className={styles.board}>
              <Chessboard
                options={{
                  position: displayedFen,
                  boardOrientation: orientation,
                  squareStyles: highlightStyles,
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
                    borderRadius: "4px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  },
                  darkSquareStyle: { backgroundColor: "#779952" },
                  lightSquareStyle: { backgroundColor: "#edeed1" },
                  darkSquareNotationStyle: { color: "#edeed1", opacity: 0.8 },
                  lightSquareNotationStyle: { color: "#779952", opacity: 0.8 },
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

          {pvPreview && (
            <div className={styles.previewBanner}>
              Showing engine line &middot;{" "}
              <button
                className={styles.previewBack}
                onClick={() => setPvPreview(null)}
              >
                Back to game
              </button>
            </div>
          )}

          <div className={styles.playerBar}>
            <span className={styles.playerBarName}>{bottomPlayer}</span>
          </div>

          <div className={styles.graphArea}>
            <ScoreGraph
              evals={evals}
              currentIndex={currentIndex}
              onSelectIndex={goTo}
            />
          </div>

          <div className={styles.navButtons}>
            <button onClick={() => goTo(0)} title="First">&laquo;</button>
            <button onClick={() => goTo(currentIndex - 1)} title="Previous">&lsaquo;</button>
            <button onClick={() => goTo(currentIndex + 1)} title="Next">&rsaquo;</button>
            <button onClick={() => goTo(gameMoves.length)} title="Last">&raquo;</button>
          </div>
        </div>

        <div className={styles.sidebar}>
          {analyzing && (
            <div className={styles.progressBar}>
              <div className={styles.progressLabel}>
                Analyzing... {progress}%
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className={styles.engineLines}>
            <h3 className={styles.engineLinesTitle}>
              Engine Lines
              {pvComputing && <span className={styles.engineSpinner} />}
            </h3>
            {pvLines.length > 0 ? (
              <div className={styles.engineLinesList}>
                {pvLines.map((pv) => (
                  <div
                    key={pv.rank}
                    className={styles.engineLine}
                    onMouseLeave={() => setHoverArrow(null)}
                  >
                    <span
                      className={`${styles.engineLineScore} ${pv.score >= 0 ? styles.engineLineWhite : styles.engineLineBlack}`}
                    >
                      {pv.mate !== null
                        ? `${pv.mate > 0 ? "+" : "\u2212"}M${Math.abs(pv.mate)}`
                        : `${pv.score >= 0 ? "+" : "\u2212"}${(Math.abs(pv.score) / 100).toFixed(1)}`}
                    </span>
                    <span className={styles.engineLineMoves}>
                      {pv.san.map((move, mi) => (
                        <span
                          key={mi}
                          className={styles.pvMove}
                          onMouseEnter={
                            mi === 0 && pv.firstMove
                              ? () => setHoverArrow(pv.firstMove)
                              : undefined
                          }
                          onClick={() =>
                            setPvPreview((prev) => [
                              ...(prev ?? []),
                              ...pv.san.slice(0, mi + 1),
                            ])
                          }
                        >
                          {move}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.engineLinesEmpty}>
                {pvComputing ? "Calculating..." : "No lines"}
              </div>
            )}
          </div>

          <div className={styles.movesPanel}>
            <h3 className={styles.movesTitle}>Moves</h3>
            <div className={styles.movesList}>
              {movePairs.map((mp) => (
                <div key={mp.num} className={styles.movePair}>
                  <span className={styles.moveNum}>{mp.num}.</span>
                  <MoveCell
                    san={mp.white}
                    posIndex={mp.whiteIdx}
                    currentIndex={currentIndex}
                    evals={evals}
                    onClick={() => goTo(mp.whiteIdx)}
                  />
                  {mp.black ? (
                    <MoveCell
                      san={mp.black}
                      posIndex={mp.blackIdx!}
                      currentIndex={currentIndex}
                      evals={evals}
                      onClick={() => goTo(mp.blackIdx!)}
                    />
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MoveCell({
  san,
  posIndex,
  currentIndex,
  evals,
  onClick,
}: {
  san: string;
  posIndex: number;
  currentIndex: number;
  evals: { classification?: MoveClassification }[];
  onClick: () => void;
}) {
  const entry = evals[posIndex];
  const classification = entry?.classification;
  const symbol = classification ? CLASSIFICATION_SYMBOLS[classification] : "";
  const color = classification ? CLASSIFICATION_COLORS[classification] : undefined;
  const isActive = posIndex === currentIndex;

  return (
    <span
      className={`${styles.moveCell} ${isActive ? styles.moveCellActive : ""}`}
      onClick={onClick}
    >
      {san}
      {symbol && (
        <span style={{ color, fontWeight: 700, marginLeft: 1 }}>{symbol}</span>
      )}
    </span>
  );
}
