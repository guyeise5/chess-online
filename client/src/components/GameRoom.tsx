import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import { socket } from "../socket";
import { RoomData, MoveData, GameOverData, TimerData } from "../types";
import styles from "./GameRoom.module.css";

interface Props {
  playerName: string;
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

export default function GameRoom({ playerName }: Props) {
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

    socket.on("game:move", handleMove);
    socket.on("game:over", handleGameOver);
    socket.on("game:timer", handleTimer);
    socket.on("game:start", handleStart);

    return () => {
      socket.off("game:move", handleMove);
      socket.off("game:over", handleGameOver);
      socket.off("game:timer", handleTimer);
      socket.off("game:start", handleStart);
    };
  }, []);

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves]);

  const isWhite = room?.whitePlayer === playerName;
  const isBlack = room?.blackPlayer === playerName;
  const isPlayer = isWhite || isBlack;
  const orientation = isBlack ? "black" : "white";

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
    if (!selectedSquare) return {};

    const targets = getLegalMovesForSquare(selectedSquare);
    const styles: Record<string, React.CSSProperties> = {
      [selectedSquare]: HIGHLIGHT_SOURCE,
    };
    for (const sq of targets) {
      const pieceOnTarget = game.get(sq as Square);
      styles[sq] = pieceOnTarget ? HIGHLIGHT_CAPTURE : HIGHLIGHT_DOT;
    }
    return styles;
  }, [selectedSquare, game, getLegalMovesForSquare]);

  const isMyTurn = useCallback(() => {
    if (status !== "playing" || !isPlayer) return false;
    const turn = game.turn();
    return (turn === "w" && isWhite) || (turn === "b" && isBlack);
  }, [status, isPlayer, game, isWhite, isBlack]);

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (!roomId) return false;
      const turn = game.turn();
      const piece = game.get(from as Square);
      const isPawn = piece && piece.type === "p";
      const promotion =
        isPawn &&
        ((turn === "w" && to[1] === "8") || (turn === "b" && to[1] === "1"))
          ? "q"
          : undefined;

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
          return true;
        }
      } catch {
        // move invalid
      }
      return false;
    },
    [game, fen, playerName, roomId]
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }): boolean => {
      setSelectedSquare(null);
      if (!targetSquare) return false;
      if (!isMyTurn()) return false;
      return tryMove(sourceSquare, targetSquare);
    },
    [isMyTurn, tryMove]
  );

  const onPieceDrag = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (!square || !isMyTurn()) {
        setSelectedSquare(null);
        return;
      }
      const piece = game.get(square as Square);
      if (!piece) { setSelectedSquare(null); return; }
      const myColor = isWhite ? "w" : "b";
      if (piece.color !== myColor) { setSelectedSquare(null); return; }
      setSelectedSquare(square);
    },
    [game, isMyTurn, isWhite]
  );

  const onPieceClick = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (!square || !isMyTurn()) {
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
      if (!piece) { setSelectedSquare(null); return; }
      const myColor = isWhite ? "w" : "b";
      if (piece.color !== myColor) { setSelectedSquare(null); return; }
      setSelectedSquare(square === selectedSquare ? null : square);
    },
    [game, selectedSquare, isMyTurn, isWhite, getLegalMovesForSquare, tryMove]
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
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={handleLeave}>
          &larr; Lobby
        </button>
        <h1 className={styles.logo}>&#9822; Chess Online</h1>
        <span className={styles.roomId}>Room: {roomId}</span>
      </header>

      <main className={styles.main}>
        <div className={styles.boardArea}>
          <div className={styles.playerBar}>
            <span className={styles.playerBarName}>{topPlayer || "Waiting..."}</span>
            <span className={`${styles.clock} ${topIsActive ? styles.clockActive : ""}`}>
              {formatTime(topTime)}
            </span>
          </div>

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

          <div className={styles.playerBar}>
            <span className={styles.playerBarName}>{bottomPlayer || "Waiting..."}</span>
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

          {isPlayer && status === "playing" && (
            <button className={styles.resignBtn} onClick={handleResign}>
              Resign
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
