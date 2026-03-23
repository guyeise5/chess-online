import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import { socket } from "../socket";
import { RoomData, MoveData, GameOverData, TimerData, UndoData } from "../types";
import { saveAnalysisGame, generateGameId } from "./AnalysisBoard";
import PromotionDialog from "./PromotionDialog";
import { computeMaterialDiff, type SideMaterial } from "../utils/materialDiff";
import MaterialDisplay from "./MaterialDisplay";
import NavBar from "./NavBar";
import styles from "./GameRoom.module.css";
import type { BoardPreferences } from "../hooks/useBoardPreferences";

interface Props {
  playerName: string;
  boardPrefs: BoardPreferences;
  onOpenSettings?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const HIGHLIGHT_SOURCE: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 0, 0.4)",
};
const HIGHLIGHT_DOT: React.CSSProperties = {
  background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
};
const HIGHLIGHT_CAPTURE: React.CSSProperties = {
  background: "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)",
};
const HIGHLIGHT_CHECK: React.CSSProperties = {
  background: "radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,76,60,0.5) 40%, rgba(169,32,32,0.15) 70%, transparent 100%)",
};
const HIGHLIGHT_PREMOVE: React.CSSProperties = {
  backgroundColor: "rgba(20, 85, 180, 0.5)",
};

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

export default function GameRoom({ playerName, boardPrefs, onOpenSettings }: Props) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<Chess>(new Chess());
  const [fen, setFen] = useState("start");
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [status, setStatus] = useState<RoomData["status"]>("waiting");
  const [result, setResult] = useState<string | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [undoRequester, setUndoRequester] = useState<string | null>(null);
  const [undoPending, setUndoPending] = useState(false);
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: string } | null>(null);
  const [premoveSelectedSquare, setPremoveSelectedSquare] = useState<string | null>(null);
  const premoveRef = useRef<{ from: string; to: string; promotion?: string } | null>(null);
  const movesEndRef = useRef<HTMLDivElement>(null);

  const rejoin = useCallback(() => {
    if (!roomId) return;
    setLoading(true);
    socket.emit(
      "room:rejoin",
      { roomId, playerName },
      (res: { success: boolean; room?: RoomData }) => {
        setLoading(false);
        if (res.success && res.room) {
          const r = res.room;
          setRoom(r);
          const g = new Chess(r.fen);
          setGame(g);
          setFen(r.fen);
          setWhiteTime(r.whiteTime);
          setBlackTime(r.blackTime);
          setStatus(r.status);
          setResult(r.result);
          setMoves(r.moves || []);
        } else {
          navigate("/", { replace: true });
        }
      }
    );
  }, [roomId, playerName, navigate]);

  useEffect(() => {
    if (socket.connected) {
      rejoin();
    } else {
      socket.once("connect", rejoin);
    }

    socket.io.on("reconnect", rejoin);

    return () => {
      socket.off("connect", rejoin);
      socket.io.off("reconnect", rejoin);
    };
  }, [rejoin]);

  useEffect(() => {
    const handleMove = (data: MoveData) => {
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setResult(data.result);
      setStatus(data.status);
      setMoves((prev) => [...prev, data.move.san]);

      const pm = premoveRef.current;
      if (
        pm &&
        data.status === "playing" &&
        isPlayerRef.current &&
        newGame.turn() === myColorRef.current
      ) {
        if (premoveTimerRef.current) clearTimeout(premoveTimerRef.current);
        premoveTimerRef.current = setTimeout(() => {
          premoveTimerRef.current = null;
          const currentPm = premoveRef.current;
          if (!currentPm) return;

          premoveRef.current = null;
          setPremove(null);
          setPremoveSelectedSquare(null);

          try {
            const g = new Chess(data.fen);
            const move = g.move({
              from: currentPm.from,
              to: currentPm.to,
              promotion: currentPm.promotion || "q",
            });
            if (move) {
              socket.emit(
                "game:move",
                {
                  roomId,
                  playerName,
                  from: currentPm.from,
                  to: currentPm.to,
                  promotion: currentPm.promotion,
                },
                (res: any) => {
                  if (!res.success) console.warn("Premove rejected:", res.error);
                }
              );
              setGame(g);
              setFen(g.fen());
              setSelectedSquare(null);
            }
          } catch {
            // Premove illegal in new position — silently cancelled
          }
        }, 100);
      }
    };

    const handleGameOver = (data: GameOverData) => {
      setResult(data.result);
      setStatus("finished");
      setGameOverReason(data.reason);
    };

    const handleTimer = (data: TimerData) => {
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
    };

    const handleStart = (roomData: RoomData) => {
      setRoom(roomData);
      setStatus(roomData.status);
    };

    const handleUndoRequest = (data: { playerName: string }) => {
      setUndoRequester(data.playerName);
    };

    const handleUndo = (data: UndoData) => {
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setMoves(data.moves);
      setUndoRequester(null);
      setUndoPending(false);
      setPremove(null);
      premoveRef.current = null;
      setPremoveSelectedSquare(null);
    };

    const handleUndoDeclined = () => {
      setUndoRequester(null);
      setUndoPending(false);
    };

    const handleUndoCancelled = () => {
      setUndoRequester(null);
      setUndoPending(false);
    };

    socket.on("game:move", handleMove);
    socket.on("game:over", handleGameOver);
    socket.on("game:timer", handleTimer);
    socket.on("game:start", handleStart);
    socket.on("game:undo-request", handleUndoRequest);
    socket.on("game:undo", handleUndo);
    socket.on("game:undo-declined", handleUndoDeclined);
    socket.on("game:undo-cancelled", handleUndoCancelled);

    return () => {
      socket.off("game:move", handleMove);
      socket.off("game:over", handleGameOver);
      socket.off("game:timer", handleTimer);
      socket.off("game:start", handleStart);
      socket.off("game:undo-request", handleUndoRequest);
      socket.off("game:undo", handleUndo);
      socket.off("game:undo-declined", handleUndoDeclined);
      socket.off("game:undo-cancelled", handleUndoCancelled);
      if (premoveTimerRef.current) clearTimeout(premoveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves]);

  const isWhite = room?.whitePlayer === playerName;
  const isBlack = room?.blackPlayer === playerName;
  const isPlayer = isWhite || isBlack;
  const orientation = isBlack ? "black" : "white";
  const myColor = isWhite ? "w" : "b";

  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  const isPlayerRef = useRef(isPlayer);
  isPlayerRef.current = isPlayer;
  const premoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const materialDiff = useMemo(() => computeMaterialDiff(game), [game]);
  const showMaterial =
    (window as any).__ENV__?.FEATURE_MATERIAL_DIFF !== "false";

  const setPremoveData = useCallback((from: string, to: string, promotion?: string) => {
    const pm = { from, to, promotion };
    setPremove(pm);
    premoveRef.current = pm;
    setPremoveSelectedSquare(null);
    setSelectedSquare(null);
  }, []);

  const clearPremove = useCallback(() => {
    setPremove(null);
    premoveRef.current = null;
    setPremoveSelectedSquare(null);
  }, []);

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

    if (game.inCheck()) {
      const kingSq = findKingSquare(game);
      if (kingSq) result[kingSq] = HIGHLIGHT_CHECK;
    }

    if (premove) {
      result[premove.from] = HIGHLIGHT_PREMOVE;
      result[premove.to] = HIGHLIGHT_PREMOVE;
    }

    if (selectedSquare) {
      result[selectedSquare] = HIGHLIGHT_SOURCE;
      const targets = getLegalMovesForSquare(selectedSquare);
      for (const sq of targets) {
        const pieceOnTarget = game.get(sq as Square);
        result[sq] = pieceOnTarget ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT;
      }
    }

    if (premoveSelectedSquare && !selectedSquare) {
      result[premoveSelectedSquare] = HIGHLIGHT_SOURCE;
    }

    return result;
  }, [selectedSquare, premoveSelectedSquare, premove, game, getLegalMovesForSquare]);

  const isMyTurn = useCallback(() => {
    if (status !== "playing" || !isPlayer) return false;
    const turn = game.turn();
    return (turn === "w" && isWhite) || (turn === "b" && isBlack);
  }, [status, isPlayer, game, isWhite, isBlack]);

  const isPromotionMove = useCallback(
    (from: string, to: string): boolean => {
      const piece = game.get(from as Square);
      if (!piece || piece.type !== "p") return false;
      const turn = game.turn();
      return (turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1");
    },
    [game]
  );

  const executeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!roomId) return false;

      socket.emit(
        "game:move",
        { roomId, playerName, from, to, promotion },
        (res: any) => {
          if (!res.success) {
            console.warn("Move rejected:", res.error);
          }
        }
      );

      try {
        const gameCopy = new Chess(fen);
        const move = gameCopy.move({ from, to, promotion: promotion || "q" });
        if (move) {
          setGame(gameCopy);
          setFen(gameCopy.fen());
          setSelectedSquare(null);
          setPendingPromotion(null);
          return true;
        }
      } catch {
        // move invalid
      }
      return false;
    },
    [game, fen, playerName, roomId]
  );

  const executeMoveRef = useRef(executeMove);
  executeMoveRef.current = executeMove;

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (!roomId) return false;
      if (isPromotionMove(from, to)) {
        setPendingPromotion({ from, to });
        setSelectedSquare(null);
        return false;
      }
      return executeMove(from, to);
    },
    [roomId, isPromotionMove, executeMove]
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }): boolean => {
      setSelectedSquare(null);
      setPremoveSelectedSquare(null);
      if (!targetSquare) return false;

      if (isMyTurn()) {
        clearPremove();
        return tryMove(sourceSquare, targetSquare);
      }

      if (status === "playing" && isPlayer) {
        const piece = game.get(sourceSquare as Square);
        if (piece && piece.color === myColor) {
          const promoRank = myColor === "w" ? "8" : "1";
          setPremoveData(sourceSquare, targetSquare, piece.type === "p" && targetSquare[1] === promoRank ? "q" : undefined);
        }
      }
      return false;
    },
    [isMyTurn, tryMove, status, isPlayer, game, myColor, setPremoveData, clearPremove]
  );

  const onPieceDrag = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (!square) {
        setSelectedSquare(null);
        setPremoveSelectedSquare(null);
        return;
      }
      const piece = game.get(square as Square);
      if (!piece || piece.color !== myColor) {
        setSelectedSquare(null);
        setPremoveSelectedSquare(null);
        return;
      }
      if (isMyTurn()) {
        setSelectedSquare(square);
      } else if (status === "playing" && isPlayer) {
        setPremoveSelectedSquare(square);
      }
    },
    [game, isMyTurn, myColor, status, isPlayer]
  );

  const onPieceClick = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (!square) {
        setSelectedSquare(null);
        setPremoveSelectedSquare(null);
        return;
      }

      if (isMyTurn()) {
        clearPremove();
        if (selectedSquare && selectedSquare !== square) {
          const targets = getLegalMovesForSquare(selectedSquare);
          if (targets.includes(square)) {
            tryMove(selectedSquare, square);
            return;
          }
        }
        const piece = game.get(square as Square);
        if (!piece) { setSelectedSquare(null); return; }
        if (piece.color !== myColor) { setSelectedSquare(null); return; }
        setSelectedSquare(square === selectedSquare ? null : square);
      } else if (status === "playing" && isPlayer) {
        if (premoveSelectedSquare && premoveSelectedSquare !== square) {
          const tgtPiece = game.get(square as Square);
          if (tgtPiece && tgtPiece.color === myColor) {
            setPremoveSelectedSquare(square);
            setPremove(null);
            premoveRef.current = null;
            return;
          }
          const srcPiece = game.get(premoveSelectedSquare as Square);
          if (srcPiece) {
            const promoRank = myColor === "w" ? "8" : "1";
            setPremoveData(premoveSelectedSquare, square, srcPiece.type === "p" && square[1] === promoRank ? "q" : undefined);
            return;
          }
        }
        const piece = game.get(square as Square);
        if (!piece || piece.color !== myColor) {
          setPremoveSelectedSquare(null);
          return;
        }
        setPremoveSelectedSquare(square === premoveSelectedSquare ? null : square);
        setPremove(null);
        premoveRef.current = null;
      }
    },
    [game, selectedSquare, premoveSelectedSquare, isMyTurn, myColor, status, isPlayer, getLegalMovesForSquare, tryMove, setPremoveData, clearPremove]
  );

  const onSquareClick = useCallback(
    ({ square }: { piece: { pieceType: string } | null; square: string }) => {
      if (isMyTurn()) {
        if (!selectedSquare) return;
        const targets = getLegalMovesForSquare(selectedSquare);
        if (targets.includes(square)) {
          tryMove(selectedSquare, square);
        } else {
          setSelectedSquare(null);
        }
      } else if (status === "playing" && isPlayer && premoveSelectedSquare) {
        const srcPiece = game.get(premoveSelectedSquare as Square);
        if (srcPiece) {
          const promoRank = myColor === "w" ? "8" : "1";
          setPremoveData(premoveSelectedSquare, square, srcPiece.type === "p" && square[1] === promoRank ? "q" : undefined);
        }
      } else {
        setSelectedSquare(null);
        setPremoveSelectedSquare(null);
      }
    },
    [selectedSquare, premoveSelectedSquare, isMyTurn, myColor, status, isPlayer, game, getLegalMovesForSquare, tryMove, setPremoveData]
  );

  const handleLeave = useCallback(() => {
    if (status === "waiting" && room?.owner === playerName) {
      socket.emit("room:leave", { roomId, playerName }, () => {});
    }
    navigate("/");
  }, [status, room, roomId, playerName, navigate]);

  useEffect(() => {
    const onClosed = () => navigate("/", { replace: true });
    socket.on("room:closed", onClosed);
    return () => { socket.off("room:closed", onClosed); };
  }, [navigate]);

  const handleResign = () => {
    if (window.confirm("Are you sure you want to resign?")) {
      socket.emit("game:resign", { roomId, playerName });
    }
  };

  if (loading || !room) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--text-secondary)" }}>
        Loading game...
      </div>
    );
  }

  const topPlayer = orientation === "white" ? room.blackPlayer : room.whitePlayer;
  const bottomPlayer = orientation === "white" ? room.whitePlayer : room.blackPlayer;
  const topTime = orientation === "white" ? blackTime : whiteTime;
  const bottomTime = orientation === "white" ? whiteTime : blackTime;
  const topMaterial: SideMaterial =
    orientation === "white" ? materialDiff.black : materialDiff.white;
  const bottomMaterial: SideMaterial =
    orientation === "white" ? materialDiff.white : materialDiff.black;
  const currentTurn = game.turn();
  const topIsActive = status === "playing" && (
    (orientation === "white" && currentTurn === "b") ||
    (orientation === "black" && currentTurn === "w")
  );
  const bottomIsActive = status === "playing" && (
    (orientation === "white" && currentTurn === "w") ||
    (orientation === "black" && currentTurn === "b")
  );

  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className={styles.container}>
      <NavBar playerName={playerName} onOpenSettings={onOpenSettings} />

      <main className={styles.main}>
        <div className={styles.boardArea}>
          <div className={styles.playerBar}>
            <div className={styles.playerInfo}>
              <span className={styles.playerBarName}>{topPlayer || "Waiting..."}</span>
              {showMaterial && <MaterialDisplay material={topMaterial} />}
            </div>
            <span className={`${styles.clock} ${topIsActive ? styles.clockActive : ""}`}>
              {formatTime(topTime)}
            </span>
          </div>

          <div className={styles.board} style={{ position: "relative" }}>
            {pendingPromotion && (
              <PromotionDialog
                color={isWhite ? "white" : "black"}
                square={pendingPromotion.to}
                orientation={orientation}
                onSelect={(piece) => executeMove(pendingPromotion.from, pendingPromotion.to, piece)}
                onCancel={() => setPendingPromotion(null)}
              />
            )}
            <Chessboard
              options={{
                pieces: boardPrefs.customPieces,
                position: fen,
                onPieceDrop: onDrop,
                onPieceDrag: onPieceDrag,
                onPieceClick: onPieceClick,
                onSquareClick: onSquareClick,
                canDragPiece: ({ piece }) => {
                  if (!isPlayer || status !== "playing") return false;
                  return piece.pieceType[0] === myColor;
                },
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

          <div className={styles.playerBar}>
            <div className={styles.playerInfo}>
              <span className={styles.playerBarName}>{bottomPlayer || "Waiting..."}</span>
              {showMaterial && <MaterialDisplay material={bottomMaterial} />}
            </div>
            <span className={`${styles.clock} ${bottomIsActive ? styles.clockActive : ""}`}>
              {formatTime(bottomTime)}
            </span>
          </div>
        </div>

        <div className={styles.sidebar}>
          {status === "waiting" && (
            <div className={styles.waitingBanner}>
              Waiting for opponent to join...
            </div>
          )}

          {status === "finished" && (
            <div className={styles.resultBanner}>
              <strong>
                {result === "1-0"
                  ? "White wins!"
                  : result === "0-1"
                  ? "Black wins!"
                  : "Draw!"}
              </strong>
              {gameOverReason && (
                <span className={styles.reason}>by {gameOverReason}</span>
              )}
              <button
                className={styles.analyzeBtn}
                onClick={() => {
                  const id = roomId ?? generateGameId();
                  saveAnalysisGame(id, {
                    moves,
                    playerWhite: room?.whitePlayer ?? "White",
                    playerBlack: room?.blackPlayer ?? "Black",
                    orientation,
                    result: result ?? undefined,
                  });
                  navigate(`/analysis/${id}`);
                }}
              >
                Analyze
              </button>
            </div>
          )}

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

          {undoRequester && undoRequester !== playerName && (
            <div className={styles.undoBanner}>
              <span>{undoRequester} requests to undo</span>
              <div className={styles.undoActions}>
                <button
                  className={styles.undoAccept}
                  onClick={() => socket.emit("game:undo-response", { roomId, accepted: true })}
                >
                  Accept
                </button>
                <button
                  className={styles.undoDecline}
                  onClick={() => socket.emit("game:undo-response", { roomId, accepted: false })}
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {isPlayer && status === "playing" && (
            <div className={styles.gameActions}>
              <button
                className={styles.undoBtn}
                disabled={moves.length === 0 || undoPending}
                onClick={() => {
                  setUndoPending(true);
                  socket.emit("game:undo-request", { roomId, playerName, moveCount: moves.length });
                }}
              >
                {undoPending ? "Undo requested..." : "Undo"}
              </button>
              <button className={styles.resignBtn} onClick={handleResign}>
                Resign
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
