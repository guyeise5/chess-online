import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import styles from "./PuzzleTrainer.module.css";

const PUZZLE_RATING_KEY = "chess-puzzle-rating";
const DEFAULT_RATING = 1500;
const RATING_DELTA = 15;
const API_BASE = import.meta.env.PROD ? "" : "http://localhost:3001";

interface PuzzleData {
  puzzleId: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

type PuzzleStatus = "loading" | "solving" | "correct" | "failed";

function getRating(): number {
  const stored = localStorage.getItem(PUZZLE_RATING_KEY);
  return stored ? parseInt(stored, 10) : DEFAULT_RATING;
}

function setRating(r: number): void {
  localStorage.setItem(PUZZLE_RATING_KEY, String(r));
}

export default function PuzzleTrainer() {
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState("start");
  const [status, setStatus] = useState<PuzzleStatus>("loading");
  const [playerRating, setPlayerRating] = useState(getRating);
  const [moveIndex, setMoveIndex] = useState(0);
  const [playedMoves, setPlayedMoves] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const movesEndRef = useRef<HTMLDivElement>(null);

  const orientation = useMemo(() => {
    if (!puzzle) return "white" as const;
    const g = new Chess(puzzle.fen);
    return g.turn() === "w" ? "black" : "white";
  }, [puzzle]);

  const fetchPuzzle = useCallback(async () => {
    setStatus("loading");
    setPlayedMoves([]);
    setSelectedSquare(null);
    setMoveIndex(0);

    try {
      const res = await fetch(`${API_BASE}/api/puzzles/random?rating=${getRating()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PuzzleData = await res.json();
      setPuzzle(data);

      const g = new Chess(data.fen);
      const opponentMove = data.moves[0];
      const from = opponentMove.slice(0, 2);
      const to = opponentMove.slice(2, 4);
      const promotion = opponentMove.length > 4 ? opponentMove[4] : undefined;

      setTimeout(() => {
        g.move({ from, to, promotion });
        setGame(g);
        setFen(g.fen());
        setMoveIndex(1);
        setPlayedMoves([g.history().slice(-1)[0]]);
        setStatus("solving");
      }, 400);

      setGame(new Chess(data.fen));
      setFen(data.fen);
    } catch (err) {
      console.error("Failed to fetch puzzle:", err);
    }
  }, []);

  useEffect(() => {
    fetchPuzzle();
  }, [fetchPuzzle]);

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playedMoves]);

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (status !== "solving" || !puzzle) return false;

      const expectedUci = puzzle.moves[moveIndex];
      if (!expectedUci) return false;

      const expectedFrom = expectedUci.slice(0, 2);
      const expectedTo = expectedUci.slice(2, 4);
      const expectedPromo = expectedUci.length > 4 ? expectedUci[4] : undefined;

      const turn = game.turn();
      const piece = game.get(from as Square);
      const isPawn = piece && piece.type === "p";
      const promotion =
        isPawn &&
        ((turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1"))
          ? expectedPromo || "q"
          : undefined;

      if (from !== expectedFrom || to !== expectedTo) {
        const newRating = Math.max(100, playerRating - RATING_DELTA);
        setPlayerRating(newRating);
        setRating(newRating);
        setStatus("failed");

        const reveal = new Chess(game.fen());
        try {
          reveal.move({ from: expectedFrom, to: expectedTo, promotion: expectedPromo });
          setGame(reveal);
          setFen(reveal.fen());
          const san = reveal.history().slice(-1)[0];
          setPlayedMoves((prev) => [...prev, san]);
        } catch { /* ignore */ }
        return false;
      }

      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from, to, promotion });
      if (!move) return false;

      setGame(gameCopy);
      setFen(gameCopy.fen());
      setSelectedSquare(null);
      setPlayedMoves((prev) => [...prev, move.san]);

      const nextIndex = moveIndex + 1;

      if (nextIndex >= puzzle.moves.length) {
        const newRating = playerRating + RATING_DELTA;
        setPlayerRating(newRating);
        setRating(newRating);
        setStatus("correct");
        setMoveIndex(nextIndex);
        return true;
      }

      const replyUci = puzzle.moves[nextIndex];
      const replyFrom = replyUci.slice(0, 2);
      const replyTo = replyUci.slice(2, 4);
      const replyPromo = replyUci.length > 4 ? replyUci[4] : undefined;

      setTimeout(() => {
        const afterReply = new Chess(gameCopy.fen());
        const replyMove = afterReply.move({ from: replyFrom, to: replyTo, promotion: replyPromo });
        if (replyMove) {
          setGame(afterReply);
          setFen(afterReply.fen());
          setPlayedMoves((prev) => [...prev, replyMove.san]);
          setMoveIndex(nextIndex + 1);
        }
      }, 400);

      setMoveIndex(nextIndex);
      return true;
    },
    [status, puzzle, moveIndex, game, playerRating]
  );

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

  const highlightStyles = useMemo((): Record<string, React.CSSProperties> => {
    if (!selectedSquare) return {};
    const targets = getLegalMovesForSquare(selectedSquare);
    const result: Record<string, React.CSSProperties> = {
      [selectedSquare]: HIGHLIGHT_SOURCE,
    };
    for (const sq of targets) {
      const pieceOnTarget = game.get(sq as Square);
      result[sq] = pieceOnTarget ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT;
    }
    return result;
  }, [selectedSquare, game, getLegalMovesForSquare]);

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
      if (!square || status !== "solving") { setSelectedSquare(null); return; }
      const piece = game.get(square as Square);
      if (!piece) { setSelectedSquare(null); return; }
      const myColor = orientation === "white" ? "w" : "b";
      if (piece.color !== myColor) { setSelectedSquare(null); return; }
      setSelectedSquare(square);
    },
    [game, status, orientation]
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

  if (status === "loading" || !puzzle) {
    return <div className={styles.loading}>Loading puzzle...</div>;
  }

  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < playedMoves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: playedMoves[i],
      black: playedMoves[i + 1],
    });
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate("/")}>
          &larr; Lobby
        </button>
        <h1 className={styles.logo}>&#9822; Puzzle Trainer</h1>
        <span className={styles.ratingBadge}>#{puzzle.puzzleId}</span>
      </header>

      <main className={styles.main}>
        <div className={styles.boardArea}>
          <div className={styles.board}>
            <Chessboard
              options={{
                position: fen,
                onPieceDrop: onDrop,
                onPieceDrag: onPieceDrag,
                onPieceClick: onPieceClick,
                onSquareClick: onSquareClick,
                squareStyles: highlightStyles,
                boardOrientation: orientation,
                animationDurationInMs: 200,
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

        <div className={styles.sidebar}>
          <div className={styles.playerRating}>
            <span className={styles.label}>Your Puzzle Rating</span>
            <span className={styles.value}>{playerRating}</span>
          </div>

          <div
            className={`${styles.statusBanner} ${
              status === "solving"
                ? styles.statusSolving
                : status === "correct"
                ? styles.statusCorrect
                : styles.statusFailed
            }`}
          >
            {status === "solving" && `Find the best move for ${orientation}`}
            {status === "correct" && "Correct! Well done."}
            {status === "failed" && "Incorrect. The correct move is shown."}
          </div>

          <div className={styles.puzzleInfo}>
            <div className={styles.puzzleRating}>
              <span>Puzzle Rating</span>
              <span>{puzzle.rating}</span>
            </div>
            {puzzle.themes.length > 0 && (
              <div className={styles.themes}>
                {puzzle.themes.map((t) => (
                  <span key={t} className={styles.theme}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.movesPanel}>
            <h3 className={styles.movesTitle}>Moves</h3>
            <div className={styles.movesList}>
              {movePairs.map((mp) => (
                <div key={mp.num} className={styles.movePair}>
                  <span className={styles.moveNum}>{mp.num}.</span>
                  <span className={styles.moveWhite}>{mp.white}</span>
                  <span className={styles.moveBlack}>{mp.black || ""}</span>
                </div>
              ))}
              <div ref={movesEndRef} />
            </div>
          </div>

          {(status === "correct" || status === "failed") && (
            <button className={styles.nextBtn} onClick={fetchPuzzle}>
              Next Puzzle
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
