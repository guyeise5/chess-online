import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import useStockfish, { getLevelConfig } from "../hooks/useStockfish";
import { saveAnalysisGame, generateGameId } from "./AnalysisBoard";
import PromotionDialog from "./PromotionDialog";
import { computeMaterialDiff, type SideMaterial } from "../utils/materialDiff";
import MaterialDisplay from "./MaterialDisplay";
import NavBar from "./NavBar";
import styles from "./ComputerGame.module.css";
import { getEnv } from "../types";
import { playMoveSound, playSound } from "../utils/sounds";
import type { BoardPreferences } from "../hooks/useBoardPreferences";

interface Props {
  playerName: string;
  boardPrefs: BoardPreferences;
  onOpenSettings?: () => void;
}

const HIGHLIGHT_SOURCE: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 0, 0.4)",
};
const HIGHLIGHT_DOT: React.CSSProperties = {
  background:
    "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
};
const HIGHLIGHT_CAPTURE: React.CSSProperties = {
  background:
    "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)",
};
const HIGHLIGHT_CHECK: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,76,60,0.5) 40%, rgba(169,32,32,0.15) 70%, transparent 100%)",
};
const HIGHLIGHT_LAST_MOVE: React.CSSProperties = {
  backgroundColor: "rgba(155, 199, 0, 0.41)",
};

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

const STORAGE_KEY = "chess-computer-game";

interface SavedGame {
  level: number;
  color: "white" | "black";
  fen: string;
  status: "playing" | "finished";
  result: string | null;
  gameOverReason: string | null;
  moves: string[];
  lastMove: { from: string; to: string } | null;
  analysisId?: string;
}

function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.level !== "number" ||
      !Array.isArray(parsed.moves) ||
      typeof parsed.fen !== "string"
    ) return null;
    return parsed as SavedGame;
  } catch {
    return null;
  }
}

function saveGame(data: SavedGame) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearSavedGame() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function ComputerGame({ playerName, boardPrefs, onOpenSettings }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state || {}) as {
    level?: number;
    color?: "white" | "black";
  };

  const saved = useRef(loadGame()).current;
  const resuming = saved !== null;

  const level = resuming ? saved!.level : (routeState.level || 3);
  const color = resuming ? saved!.color : (routeState.color || "white");

  const { ready, getMove, stop } = useStockfish(level);
  const levelConfig = getLevelConfig(level);

  const initialFen = resuming ? saved!.fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const [game, setGame] = useState<Chess>(() => new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [status, setStatus] = useState<"playing" | "finished">(resuming ? saved!.status : "playing");
  const [result, setResult] = useState<string | null>(resuming ? saved!.result : null);
  const [gameOverReason, setGameOverReason] = useState<string | null>(resuming ? saved!.gameOverReason : null);
  const [moves, setMoves] = useState<string[]>(resuming ? saved!.moves : []);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(resuming ? saved!.lastMove : null);
  const [computerThinking, setComputerThinking] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(resuming ? saved!.analysisId ?? null : null);
  const [resignConfirm, setResignConfirm] = useState(false);
  const resignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist game state to localStorage on every meaningful change
  useEffect(() => {
    saveGame({
      level, color,
      fen, status, result, gameOverReason,
      moves, lastMove,
      ...(analysisId != null ? { analysisId } : {}),
    });
  }, [level, color, fen, status, result, gameOverReason, moves, lastMove, analysisId]);

  const movesEndRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const statusRef = useRef(status);
  statusRef.current = status;
  const moveGenRef = useRef(0);
  const computerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlayerWhite = color === "white";
  const orientation = color;
  const playerColor = isPlayerWhite ? "w" : "b";

  const isPlayerTurn = useCallback(() => {
    return statusRef.current === "playing" && gameRef.current.turn() === playerColor;
  }, [playerColor]);

  const checkGameEnd = useCallback(
    (g: Chess) => {
      if (g.isCheckmate()) {
        const winner = g.turn() === "w" ? "0-1" : "1-0";
        setResult(winner);
        setStatus("finished");
        setGameOverReason("checkmate");
        return true;
      }
      if (g.isStalemate()) {
        setResult("1/2-1/2");
        setStatus("finished");
        setGameOverReason("stalemate");
        return true;
      }
      if (g.isDraw()) {
        setResult("1/2-1/2");
        setStatus("finished");
        setGameOverReason("draw");
        return true;
      }
      if (g.isThreefoldRepetition()) {
        setResult("1/2-1/2");
        setStatus("finished");
        setGameOverReason("repetition");
        return true;
      }
      if (g.isInsufficientMaterial()) {
        setResult("1/2-1/2");
        setStatus("finished");
        setGameOverReason("insufficient material");
        return true;
      }
      return false;
    },
    []
  );

  const applyMove = useCallback(
    (
      g: Chess,
      from: string,
      to: string,
      promotion?: string
    ): Chess | null => {
      try {
        const move = g.move({ from, to, ...(promotion != null ? { promotion } : {}) });
        if (!move) return null;
        const newGame = new Chess(g.fen());
        gameRef.current = newGame;
        setGame(newGame);
        setFen(g.fen());
        setMoves((prev) => [...prev, move.san]);
        setLastMove({ from: move.from, to: move.to });
        playMoveSound(move.san);
        const ended = checkGameEnd(g);
        if (ended) playSound("gameEnd");
        return newGame;
      } catch {
        return null;
      }
    },
    [checkGameEnd]
  );

  // Trigger computer move when it's the computer's turn (initial or after resume)
  useEffect(() => {
    if (!ready || status !== "playing") return;
    if (gameRef.current.turn() !== playerColor) {
      const gen = moveGenRef.current;
      setComputerThinking(true);
      getMove(gameRef.current.fen()).then((uci) => {
        if (gen !== moveGenRef.current) return;
        if (statusRef.current !== "playing") return;
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci.length > 4 ? uci[4] : undefined;
        const g = new Chess(gameRef.current.fen());
        applyMove(g, from, to, promo);
        setComputerThinking(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const makeComputerMove = useCallback(
    (currentFen: string) => {
      if (statusRef.current !== "playing") return;
      const gen = moveGenRef.current;
      setComputerThinking(true);
      getMove(currentFen).then((uci) => {
        if (gen !== moveGenRef.current) return;
        if (statusRef.current !== "playing") return;
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci.length > 4 ? uci[4] : undefined;
        const g = new Chess(currentFen);
        applyMove(g, from, to, promo);
        setComputerThinking(false);
      });
    },
    [getMove, applyMove]
  );

  // Auto-save game to server when it finishes
  useEffect(() => {
    if (status !== "finished" || analysisId) return;
    const id = generateGameId();
    setAnalysisId(id);
    saveAnalysisGame(id, {
      moves,
      playerWhite: isPlayerWhite ? playerName : `Stockfish ${levelConfig.label}`,
      playerBlack: isPlayerWhite ? `Stockfish ${levelConfig.label}` : playerName,
      orientation: color,
      ...(result != null ? { result } : {}),
    });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves]);

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

    if (selectedSquare) {
      result[selectedSquare] = HIGHLIGHT_SOURCE;
      const targets = getLegalMovesForSquare(selectedSquare);
      for (const sq of targets) {
        const pieceOnTarget = game.get(sq as Square);
        result[sq] = pieceOnTarget ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT;
      }
    }

    return result;
  }, [selectedSquare, game, getLegalMovesForSquare, lastMove]);

  const isPromotionMove = useCallback(
    (from: string, to: string): boolean => {
      const piece = game.get(from as Square);
      if (!piece || piece.type !== "p") return false;
      const turn = game.turn();
      return (
        (turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1")
      );
    },
    [game]
  );

  const executeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!isPlayerTurn()) return false;

      const g = new Chess(game.fen());
      const result = applyMove(g, from, to, promotion);
      setPendingPromotion(null);
      setSelectedSquare(null);

      if (result && statusRef.current === "playing") {
        computerTimerRef.current = setTimeout(() => {
          computerTimerRef.current = null;
          makeComputerMove(g.fen());
        }, 300);
      }

      return !!result;
    },
    [game, isPlayerTurn, applyMove, makeComputerMove]
  );

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (isPromotionMove(from, to)) {
        setPendingPromotion({ from, to });
        setSelectedSquare(null);
        return false;
      }
      return executeMove(from, to);
    },
    [isPromotionMove, executeMove]
  );

  const onDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: { pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }): boolean => {
      setSelectedSquare(null);
      if (!targetSquare) return false;
      if (!isPlayerTurn()) return false;
      return tryMove(sourceSquare, targetSquare);
    },
    [isPlayerTurn, tryMove]
  );

  const onPieceDrag = useCallback(
    ({
      square,
    }: {
      isSparePiece: boolean;
      piece: { pieceType: string };
      square: string | null;
    }) => {
      if (!square || !isPlayerTurn()) {
        setSelectedSquare(null);
        return;
      }
      const piece = game.get(square as Square);
      if (!piece) {
        setSelectedSquare(null);
        return;
      }
      if (piece.color !== playerColor) {
        setSelectedSquare(null);
        return;
      }
      setSelectedSquare(square);
    },
    [game, isPlayerTurn, playerColor]
  );

  const onPieceClick = useCallback(
    ({
      square,
    }: {
      isSparePiece: boolean;
      piece: { pieceType: string };
      square: string | null;
    }) => {
      if (!square || !isPlayerTurn()) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare && selectedSquare !== square) {
        const targets = getLegalMovesForSquare(selectedSquare);
        if (targets.includes(square)) {
          tryMove(selectedSquare, square);
          return;
        }
      }

      const piece = game.get(square as Square);
      if (!piece) {
        setSelectedSquare(null);
        return;
      }
      if (piece.color !== playerColor) {
        setSelectedSquare(null);
        return;
      }
      setSelectedSquare(square === selectedSquare ? null : square);
    },
    [
      game,
      selectedSquare,
      isPlayerTurn,
      playerColor,
      getLegalMovesForSquare,
      tryMove,
    ]
  );

  const onSquareClick = useCallback(
    ({
      square,
    }: {
      piece: { pieceType: string } | null;
      square: string;
    }) => {
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

  const startResignConfirm = useCallback(() => {
    setResignConfirm(true);
    if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
    resignTimerRef.current = setTimeout(() => setResignConfirm(false), 3000);
  }, []);

  const cancelResignConfirm = useCallback(() => {
    setResignConfirm(false);
    if (resignTimerRef.current) { clearTimeout(resignTimerRef.current); resignTimerRef.current = null; }
  }, []);

  const confirmResign = useCallback(() => {
    cancelResignConfirm();
    stop();
    const loser = isPlayerWhite ? "0-1" : "1-0";
    setResult(loser);
    setStatus("finished");
    setGameOverReason("resignation");
    playSound("gameEnd");
  }, [isPlayerWhite, stop, cancelResignConfirm]);

  const handleUndo = () => {
    if (moves.length === 0 || status !== "playing") return;
    moveGenRef.current++;
    if (computerTimerRef.current) {
      clearTimeout(computerTimerRef.current);
      computerTimerRef.current = null;
    }
    stop();
    setComputerThinking(false);

    const g = new Chess();
    try {
      for (const san of moves) g.move(san);
    } catch {
      return;
    }

    let undone = 0;
    do {
      if (g.history().length === 0) break;
      g.undo();
      undone++;
    } while (undone < 2 && g.turn() !== playerColor);

    if (undone === 0) return;

    const newFen = g.fen();
    setGame(new Chess(newFen));
    setFen(newFen);
    setMoves((prev) => prev.slice(0, -undone));
    const history = g.history({ verbose: true });
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last) {
        setLastMove({ from: last.from, to: last.to });
      }
    } else {
      setLastMove(null);
    }

    if (g.turn() !== playerColor) {
      computerTimerRef.current = setTimeout(() => {
        computerTimerRef.current = null;
        makeComputerMove(newFen);
      }, 300);
    }
  };

  const handleNewGame = () => {
    clearSavedGame();
    navigate("/");
  };

  const topPlayerName = `Stockfish ${levelConfig.label}`;
  const bottomPlayerName = playerName;

  const materialDiff = useMemo(() => computeMaterialDiff(game), [game]);
  const topMaterial: SideMaterial = isPlayerWhite
    ? materialDiff.black
    : materialDiff.white;
  const bottomMaterial: SideMaterial = isPlayerWhite
    ? materialDiff.white
    : materialDiff.black;
  const showMaterial =
    getEnv().FEATURE_MATERIAL_DIFF !== "false";

  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i] ?? "",
      ...(moves[i + 1] !== undefined ? { black: moves[i + 1] } : {}),
    });
  }

  return (
    <div className={styles['container']}>
      <NavBar playerName={playerName} {...(onOpenSettings ? { onOpenSettings } : {})} />

      <main className={styles['main']}>
        <div className={styles['boardArea']}>
          <div className={styles['playerBar']}>
            <span className={styles['playerBarName']}>{topPlayerName}</span>
            {showMaterial && <MaterialDisplay material={topMaterial} />}
          </div>

          <div className={styles['board']} style={{ position: "relative" }}>
            {pendingPromotion && (
              <PromotionDialog
                color={color}
                square={pendingPromotion.to}
                orientation={orientation}
                onSelect={(piece) =>
                  executeMove(
                    pendingPromotion.from,
                    pendingPromotion.to,
                    piece
                  )
                }
                onCancel={() => setPendingPromotion(null)}
              />
            )}
            <Chessboard
              options={{
                ...(boardPrefs.customPieces ? { pieces: boardPrefs.customPieces } : {}),
                position: fen,
                onPieceDrop: onDrop,
                onPieceDrag: onPieceDrag,
                onPieceClick: onPieceClick,
                onSquareClick: onSquareClick,
                squareStyles: highlightStyles,
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
            <span className={styles['playerBarName']}>{bottomPlayerName}</span>
            {showMaterial && <MaterialDisplay material={bottomMaterial} />}
          </div>
        </div>

        <div className={styles['sidebar']}>
          {computerThinking && status === "playing" && (
            <div className={styles['thinkingBanner']}>Stockfish is thinking...</div>
          )}

          {status === "finished" && (
            <div className={styles['resultBanner']}>
              <strong>
                {result === "1-0"
                  ? "White wins!"
                  : result === "0-1"
                    ? "Black wins!"
                    : "Draw!"}
              </strong>
              {gameOverReason && (
                <span className={styles['reason']}>by {gameOverReason}</span>
              )}
              <button
                className={styles['newGameBtn']}
                onClick={() => {
                  let id = analysisId;
                  if (!id) {
                    id = generateGameId();
                    setAnalysisId(id);
                    saveAnalysisGame(id, {
                      moves,
                      playerWhite: isPlayerWhite
                        ? playerName
                        : `Stockfish ${levelConfig.label}`,
                      playerBlack: isPlayerWhite
                        ? `Stockfish ${levelConfig.label}`
                        : playerName,
                      orientation: color,
                      ...(result != null ? { result } : {}),
                    });
                  }
                  navigate(`/analysis/${id}`);
                }}
              >
                Analyze
              </button>
              <button className={styles['newGameBtn']} onClick={handleNewGame}>
                New Game
              </button>
            </div>
          )}

          <div className={styles['movesPanel']}>
            <h3 className={styles['movesTitle']}>Moves</h3>
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

          {status === "playing" && (
            <div className={styles['gameActions']}>
              <button
                className={styles['actionBtn']}
                disabled={moves.length === 0}
                onClick={handleUndo}
                title="Takeback"
              >
                ↶
              </button>
              <button
                className={`${styles['actionBtn']} ${resignConfirm ? styles['actionResignArmed'] : ""}`}
                onClick={resignConfirm ? confirmResign : startResignConfirm}
                title={resignConfirm ? "Click again to confirm resignation" : "Resign"}
              >
                ⚑
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
