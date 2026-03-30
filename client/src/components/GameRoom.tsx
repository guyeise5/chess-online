import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import { socket } from "../socket";
import { RoomData, MoveData, GameOverData, TimerData, UndoData, SocketResult, ChatMessage, ChatMessageData, getEnv } from "../types";
import { saveAnalysisGame, generateGameId } from "./AnalysisBoard";
import PromotionDialog from "./PromotionDialog";
import { computeMaterialDiff, type SideMaterial } from "../utils/materialDiff";
import MaterialDisplay from "./MaterialDisplay";
import NavBar from "./NavBar";
import GameChat from "./GameChat";
import styles from "./GameRoom.module.css";
import { useI18n } from "../i18n/I18nProvider";
import { translateEndgameReason } from "../i18n/gameReason";
import { playMoveSound, playSound } from "../utils/sounds";
import type { BoardPreferences } from "../hooks/useBoardPreferences";

interface Props {
  userId: string;
  displayName: string;
  boardPrefs: BoardPreferences;
  onOpenSettings?: () => void;
  onActiveGameChange?: (roomId: string | null) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (seconds < 10) {
    const tenths = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${tenths}`;
  }
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

export default function GameRoom({ userId, displayName, boardPrefs, onOpenSettings, onActiveGameChange }: Props) {
  const { t, locale } = useI18n();
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
  const [drawOfferer, setDrawOfferer] = useState<string | null>(null);
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);
  const [drawConfirm, setDrawConfirm] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectClaimAvailable, setDisconnectClaimAvailable] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(10);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: string } | null>(null);
  const [premoveSelectedSquare, setPremoveSelectedSquare] = useState<string | null>(null);
  const [viewingPly, setViewingPly] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatIdRef = useRef(0);
  const premoveRef = useRef<{ from: string; to: string; promotion?: string } | null>(null);
  const resignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movesEndRef = useRef<HTMLDivElement>(null);
  const lowTimeFiredRef = useRef<{ w: boolean; b: boolean }>({ w: false, b: false });

  const addChatMessage = useCallback(
    (data: ChatMessageData) => {
      chatIdRef.current += 1;
      const msg: ChatMessage = { ...data, id: String(chatIdRef.current) };
      setChatMessages((prev) => [...prev, msg]);
    },
    []
  );

  const rejoin = useCallback(() => {
    if (!roomId) return;
    setLoading(true);
    socket.emit(
      "room:rejoin",
      { roomId, userId },
      (res: { success: boolean; room?: RoomData }) => {
        setLoading(false);
        if (res?.success && res.room) {
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
          if (Array.isArray(r.chatMessages)) {
            const loaded: ChatMessage[] = r.chatMessages.map((m, i) => ({
              ...m,
              id: String(i + 1),
            }));
            setChatMessages(loaded);
            chatIdRef.current = loaded.length;
          }
          lowTimeFiredRef.current = { w: false, b: false };
          if (r.moves?.length) {
            const replay = new Chess();
            let last: { from: string; to: string } | null = null;
            for (const san of r.moves) {
              const m = replay.move(san);
              if (m) last = { from: m.from, to: m.to };
            }
            setLastMove(last);
          }
        } else {
          navigate("/", { replace: true });
        }
      }
    );
  }, [roomId, userId, navigate]);

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
      if (!data?.move || typeof data.move.san !== "string") return;
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setResult(data.result);
      setStatus(data.status);
      setMoves((prev) => [...prev, data.move.san]);
      setLastMove({ from: data.move.from, to: data.move.to });
      playMoveSound(data.move.san);

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
                  userId,
                  from: currentPm.from,
                  to: currentPm.to,
                  ...(currentPm.promotion != null ? { promotion: currentPm.promotion } : {}),
                },
                (res: SocketResult) => {
                  if (res && !res.success) console.warn("Premove rejected:", res.error);
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
      setDrawOfferer(null);
      setDrawOfferPending(false);
      playSound("gameEnd");
    };

    const handleTimer = (data: TimerData) => {
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      const LOW_TIME_SECS = 10;
      const color = myColorRef.current === "w" ? "w" as const : "b" as const;
      const myTime = color === "w" ? data.whiteTime : data.blackTime;
      if (
        isPlayerRef.current &&
        typeof myTime === "number" &&
        myTime > 0 &&
        myTime <= LOW_TIME_SECS &&
        !lowTimeFiredRef.current[color]
      ) {
        lowTimeFiredRef.current[color] = true;
        playSound("lowTime");
      }
    };

    const handleStart = (roomData: RoomData) => {
      setRoom(roomData);
      setStatus(roomData.status);
      lowTimeFiredRef.current = { w: false, b: false };
      if (roomData.status === "playing") playSound("gameStart");
      if (Array.isArray(roomData.chatMessages)) {
        const loaded: ChatMessage[] = roomData.chatMessages.map((m, i) => ({
          ...m,
          id: String(i + 1),
        }));
        setChatMessages(loaded);
        chatIdRef.current = loaded.length;
      }
    };

    const handleChat = (data: unknown) => {
      if (
        !data ||
        typeof data !== "object" ||
        !("type" in data) ||
        !("text" in data) ||
        !("timestamp" in data)
      )
        return;
      const d = data as ChatMessageData;
      addChatMessage(d);
    };

    const handleUndoRequest = (data: { userId: string }) => {
      setUndoRequester(data.userId);
    };

    const handleUndo = (data: UndoData) => {
      if (!data?.fen) return;
      const moves = Array.isArray(data.moves) ? data.moves : [];
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setMoves(moves);
      if (moves.length) {
        const replay = new Chess();
        let last: { from: string; to: string } | null = null;
        for (const san of moves) {
          const m = replay.move(san);
          if (m) last = { from: m.from, to: m.to };
        }
        setLastMove(last);
      } else {
        setLastMove(null);
      }
      setUndoRequester(null);
      setUndoPending(false);
      setDrawOfferer(null);
      setDrawOfferPending(false);
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

    const handleDrawOffer = (data: { userId: string }) => {
      setDrawOfferer(data.userId);
      setDrawConfirm(false);
      if (drawTimerRef.current) { clearTimeout(drawTimerRef.current); drawTimerRef.current = null; }
    };

    const handleDrawDeclined = () => {
      setDrawOfferer(null);
      setDrawOfferPending(false);
    };

    const handleDrawCancelled = () => {
      setDrawOfferer(null);
      setDrawOfferPending(false);
    };

    const handleOpponentDisconnected = (_data: { userId: string }) => {
      setOpponentDisconnected(true);
      setDisconnectClaimAvailable(false);
      setDisconnectCountdown(10);
    };

    const handleOpponentReconnected = (_data: { userId: string }) => {
      setOpponentDisconnected(false);
      setDisconnectClaimAvailable(false);
      setDisconnectCountdown(10);
    };

    const handleDisconnectClaimAvailable = () => {
      setDisconnectClaimAvailable(true);
    };

    socket.on("game:move", handleMove);
    socket.on("game:over", handleGameOver);
    socket.on("game:timer", handleTimer);
    socket.on("game:start", handleStart);
    socket.on("game:undo-request", handleUndoRequest);
    socket.on("game:undo", handleUndo);
    socket.on("game:undo-declined", handleUndoDeclined);
    socket.on("game:undo-cancelled", handleUndoCancelled);
    socket.on("game:draw-offer", handleDrawOffer);
    socket.on("game:draw-declined", handleDrawDeclined);
    socket.on("game:draw-cancelled", handleDrawCancelled);
    socket.on("game:opponent-disconnected", handleOpponentDisconnected);
    socket.on("game:opponent-reconnected", handleOpponentReconnected);
    socket.on("game:disconnect-claim-available", handleDisconnectClaimAvailable);
    socket.on("game:chat", handleChat);

    return () => {
      socket.off("game:move", handleMove);
      socket.off("game:over", handleGameOver);
      socket.off("game:timer", handleTimer);
      socket.off("game:start", handleStart);
      socket.off("game:undo-request", handleUndoRequest);
      socket.off("game:undo", handleUndo);
      socket.off("game:undo-declined", handleUndoDeclined);
      socket.off("game:undo-cancelled", handleUndoCancelled);
      socket.off("game:draw-offer", handleDrawOffer);
      socket.off("game:draw-declined", handleDrawDeclined);
      socket.off("game:draw-cancelled", handleDrawCancelled);
      socket.off("game:opponent-disconnected", handleOpponentDisconnected);
      socket.off("game:opponent-reconnected", handleOpponentReconnected);
      socket.off("game:disconnect-claim-available", handleDisconnectClaimAvailable);
      socket.off("game:chat", handleChat);
      if (premoveTimerRef.current) clearTimeout(premoveTimerRef.current);
      if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    };
  }, [addChatMessage, roomId, userId]);

  const statusRef = useRef(status);
  statusRef.current = status;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const turnRef = useRef<"w" | "b">("w");
  turnRef.current = game.turn();

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      if (turnRef.current === "w") {
        setWhiteTime((prev) => Math.max(0, prev - 0.1));
      } else {
        setBlackTime((prev) => Math.max(0, prev - 0.1));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === "playing" && roomId) {
      onActiveGameChange?.(roomId);
    } else if (status === "finished") {
      onActiveGameChange?.(null);
    }
  }, [status, roomId, onActiveGameChange]);

  useEffect(() => {
    return () => {
      if (statusRef.current === "playing" && roomIdRef.current) {
        socket.emit("game:player-left", { roomId: roomIdRef.current, userId });
        onActiveGameChange?.(null);
      }
    };
  }, [userId, onActiveGameChange]);

  useEffect(() => {
    if (!opponentDisconnected || disconnectClaimAvailable) return;
    const interval = setInterval(() => {
      setDisconnectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [opponentDisconnected, disconnectClaimAvailable]);

  useEffect(() => {
    if (status === "finished") {
      setOpponentDisconnected(false);
      setDisconnectClaimAvailable(false);
    }
  }, [status]);

  const gameSavedRef = useRef(false);
  useEffect(() => {
    if (status !== "finished" || gameSavedRef.current) return;
    if (getEnv().FEATURE_GAME_STORAGE === "false") return;
    if (!moves.length) return;
    gameSavedRef.current = true;
    const id = roomId ?? generateGameId();
    saveAnalysisGame(id, {
      moves,
      playerWhite: room?.whiteName ?? room?.whitePlayer ?? "White",
      playerBlack: room?.blackName ?? room?.blackPlayer ?? "Black",
      orientation: isBlack ? "black" : "white",
      ...(result != null ? { result } : {}),
    });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves]);

  const isWhite = room?.whitePlayer === userId;
  const isBlack = room?.blackPlayer === userId;
  const isPlayer = isWhite || isBlack;
  const orientation = isBlack ? "black" : "white";
  const myColor = isWhite ? "w" : "b";

  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  const isPlayerRef = useRef(isPlayer);
  isPlayerRef.current = isPlayer;
  const premoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const materialDiff = useMemo(() => computeMaterialDiff(game), [game]);
  const env = getEnv();
  const showMaterial = env.FEATURE_MATERIAL_DIFF !== "false";
  const showDrawOffer = env.FEATURE_DRAW_OFFER !== "false";
  const showDisconnectClaim = env.FEATURE_DISCONNECT_CLAIM !== "false";
  const showChat = env.FEATURE_GAME_CHAT !== "false";
  const historyBrowseEnabled = env.FEATURE_MOVE_HISTORY_BROWSE !== "false";

  const isBrowsingHistory = historyBrowseEnabled && viewingPly !== null && viewingPly < moves.length;

  const historySnapshot = useMemo(() => {
    if (viewingPly === null) return null;
    const g = new Chess();
    let lm: { from: string; to: string } | null = null;
    for (let i = 0; i < viewingPly && i < moves.length; i++) {
      const m = g.move(moves[i]!);
      if (m) lm = { from: m.from, to: m.to };
    }
    return { fen: g.fen(), lastMove: lm, game: g };
  }, [viewingPly, moves]);

  const displayFen = isBrowsingHistory && historySnapshot ? historySnapshot.fen : fen;
  const displayLastMove = isBrowsingHistory && historySnapshot ? historySnapshot.lastMove : lastMove;

  const goToPly = useCallback((ply: number) => {
    if (ply >= moves.length) {
      setViewingPly(null);
    } else {
      setViewingPly(Math.max(0, ply));
    }
  }, [moves.length]);

  useEffect(() => {
    if (!historyBrowseEnabled || status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewingPly((prev) => {
          const cur = prev ?? moves.length;
          return cur <= 0 ? 0 : cur - 1;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewingPly((prev) => {
          if (prev === null) return null;
          return prev + 1 >= moves.length ? null : prev + 1;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyBrowseEnabled, status, moves.length]);

  const setPremoveData = useCallback((from: string, to: string, promotion?: string) => {
    const pm = { from, to, ...(promotion != null ? { promotion } : {}) };
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

    const lm = displayLastMove;
    if (lm) {
      result[lm.from] = HIGHLIGHT_LAST_MOVE;
      result[lm.to] = HIGHLIGHT_LAST_MOVE;
    }

    if (isBrowsingHistory) return result;

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
  }, [selectedSquare, premoveSelectedSquare, premove, displayLastMove, game, getLegalMovesForSquare, isBrowsingHistory]);

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
        { roomId, userId, from, to, ...(promotion != null ? { promotion } : {}) },
        (res: SocketResult) => {
          if (res && !res.success) {
            console.warn("Move rejected:", res.error);
          }
        }
      );

      try {
        const gameCopy = new Chess(fen);
        const move = gameCopy.move({ from, to, ...(promotion != null ? { promotion } : { promotion: "q" }) });
        if (move) {
          setGame(gameCopy);
          setFen(gameCopy.fen());
          setLastMove({ from, to });
          setSelectedSquare(null);
          setPendingPromotion(null);
          return true;
        }
      } catch {
        // move invalid
      }
      return false;
    },
    [game, fen, userId, roomId]
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

  useEffect(() => {
    const onClosed = () => navigate("/", { replace: true });
    socket.on("room:closed", onClosed);
    return () => { socket.off("room:closed", onClosed); };
  }, [navigate]);

  const startResignConfirm = useCallback(() => {
    setResignConfirm(true);
    setDrawConfirm(false);
    if (drawTimerRef.current) { clearTimeout(drawTimerRef.current); drawTimerRef.current = null; }
    if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
    resignTimerRef.current = setTimeout(() => setResignConfirm(false), 3000);
  }, []);

  const cancelResignConfirm = useCallback(() => {
    setResignConfirm(false);
    if (resignTimerRef.current) { clearTimeout(resignTimerRef.current); resignTimerRef.current = null; }
  }, []);

  const confirmResign = useCallback(() => {
    cancelResignConfirm();
    socket.emit("game:resign", { roomId, userId });
  }, [roomId, userId, cancelResignConfirm]);

  const startDrawConfirm = useCallback(() => {
    setDrawConfirm(true);
    setResignConfirm(false);
    if (resignTimerRef.current) { clearTimeout(resignTimerRef.current); resignTimerRef.current = null; }
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(() => setDrawConfirm(false), 3000);
  }, []);

  const cancelDrawConfirm = useCallback(() => {
    setDrawConfirm(false);
    if (drawTimerRef.current) { clearTimeout(drawTimerRef.current); drawTimerRef.current = null; }
  }, []);

  const confirmDrawOffer = useCallback(() => {
    cancelDrawConfirm();
    setDrawOfferPending(true);
    socket.emit("game:draw-offer", { roomId, userId }, (res: SocketResult) => {
      if (!res?.success) setDrawOfferPending(false);
    });
  }, [roomId, userId, cancelDrawConfirm]);

  if (loading || !room) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--text-secondary)" }}>
        {t("game.loading")}
      </div>
    );
  }

  const topPlayer = orientation === "white"
    ? (room.blackName ?? room.blackPlayer)
    : (room.whiteName ?? room.whitePlayer);
  const bottomPlayer = orientation === "white"
    ? (room.whiteName ?? room.whitePlayer)
    : (room.blackName ?? room.blackPlayer);
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
      white: moves[i] ?? "",
      ...(moves[i + 1] !== undefined ? { black: moves[i + 1] } : {}),
    });
  }

  return (
    <div className={styles['container']}>
      <NavBar displayName={displayName} {...(onOpenSettings ? { onOpenSettings } : {})} inActiveGame={status === "playing"} />

      <main className={styles['main']}>
        <div className={styles['boardArea']} dir="ltr">
          <div className={styles['playerBar']}>
            <div className={styles['playerInfo']}>
              <span className={styles['playerBarName']}>{topPlayer || t("game.waiting")}</span>
              {showMaterial && <MaterialDisplay material={topMaterial} />}
            </div>
            <div className={styles['clockRow']}>
              {isPlayer && status === "playing" && getEnv().FEATURE_GIVE_TIME !== "false" && (
                <button
                  className={styles['giveTimeBtn']}
                  onClick={() => socket.emit("game:give-time", { roomId, userId }, () => {})}
                  title={t("game.giveTime")}
                >
                  +
                </button>
              )}
              <span className={`${styles['clock']} ${topIsActive ? styles['clockActive'] : ""}${topTime <= 10 ? ` ${styles['clockLow']}` : ""}`}>
                {formatTime(topTime)}
              </span>
            </div>
          </div>

          <div className={styles['board']} style={{ position: "relative" }}>
            {isBrowsingHistory && <div className={styles['boardOverlay']} />}
            {pendingPromotion && !isBrowsingHistory && (
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
                ...(boardPrefs.customPieces ? { pieces: boardPrefs.customPieces } : {}),
                position: displayFen,
                onPieceDrop: isBrowsingHistory ? () => false : onDrop,
                onPieceDrag: isBrowsingHistory ? () => {} : onPieceDrag,
                onPieceClick: isBrowsingHistory ? () => {} : onPieceClick,
                onSquareClick: isBrowsingHistory ? () => {} : onSquareClick,
                canDragPiece: ({ piece }) => {
                  if (isBrowsingHistory) return false;
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

          <div className={styles['playerBar']}>
            <div className={styles['playerInfo']}>
              <span className={styles['playerBarName']}>{bottomPlayer || t("game.waiting")}</span>
              {showMaterial && <MaterialDisplay material={bottomMaterial} />}
            </div>
            <span className={`${styles['clock']} ${bottomIsActive ? styles['clockActive'] : ""}${bottomTime <= 10 ? ` ${styles['clockLow']}` : ""}`}>
              {formatTime(bottomTime)}
            </span>
          </div>
        </div>

        <div className={styles['sidebar']}>
          {status === "waiting" && (
            <div className={styles['waitingBanner']}>
              {t("game.waitingBanner")}
            </div>
          )}

          {status === "finished" && (
            <div className={styles['resultBanner']}>
              <strong>
                {result === "1-0"
                  ? t("game.whiteWins")
                  : result === "0-1"
                  ? t("game.blackWins")
                  : t("game.draw")}
              </strong>
              {gameOverReason && (
                <span className={styles['reason']}>
                  {locale === "he"
                    ? translateEndgameReason(gameOverReason, locale, t)
                    : `${t("game.by")} ${gameOverReason}`}
                </span>
              )}
              <button
                type="button"
                className={styles['analyzeBtn']}
                onClick={() => {
                  const id = roomId ?? generateGameId();
                  saveAnalysisGame(id, {
                    moves,
                    playerWhite: room?.whiteName ?? room?.whitePlayer ?? "White",
                    playerBlack: room?.blackName ?? room?.blackPlayer ?? "Black",
                    orientation,
                    ...(result != null ? { result } : {}),
                  });
                  navigate(`/analysis/${id}`);
                }}
              >
                {t("game.analyze")}
              </button>
            </div>
          )}

          <div className={styles['movesPanel']}>
            <h3 className={styles['movesTitle']}>{t("game.moves")}</h3>
            <div className={styles['movesList']}>
              {movePairs.map((mp) => {
                const whiteIdx = (mp.num - 1) * 2 + 1;
                const blackIdx = whiteIdx + 1;
                return (
                  <div key={mp.num} className={styles['movePair']}>
                    <span className={styles['moveNum']}>{mp.num}.</span>
                    <span
                      className={`${styles['moveWhite']}${historyBrowseEnabled && viewingPly === whiteIdx ? ` ${styles['moveCellActive']}` : ""}`}
                      onClick={historyBrowseEnabled ? () => goToPly(whiteIdx) : undefined}
                    >
                      {mp.white}
                    </span>
                    <span
                      className={`${styles['moveBlack']}${historyBrowseEnabled && viewingPly === blackIdx ? ` ${styles['moveCellActive']}` : ""}`}
                      onClick={historyBrowseEnabled && mp.black ? () => goToPly(blackIdx) : undefined}
                    >
                      {mp.black || ""}
                    </span>
                  </div>
                );
              })}
              <div ref={movesEndRef} />
            </div>
          </div>

          {showDisconnectClaim && opponentDisconnected && isPlayer && status === "playing" && (
            <div className={styles['disconnectBanner']}>
              {disconnectClaimAvailable ? (
                <>
                  <span>{t("game.opponentLeft")}</span>
                  <div className={styles['disconnectActions']}>
                    <button
                      type="button"
                      className={styles['claimWinBtn']}
                      onClick={() => socket.emit("game:claim-disconnect-win", { roomId, userId }, () => {})}
                    >
                      {t("game.claimWin")}
                    </button>
                    <button
                      type="button"
                      className={styles['claimDrawBtn']}
                      onClick={() => socket.emit("game:claim-disconnect-draw", { roomId, userId }, () => {})}
                    >
                      {t("game.claimDraw")}
                    </button>
                  </div>
                </>
              ) : (
                <span>{t("game.reconnecting")} ({disconnectCountdown}{t("common.seconds")})</span>
              )}
            </div>
          )}

          {isPlayer && status === "playing" && (
            <>
              {undoRequester && undoRequester !== userId && (
                <div className={styles['requestLabel']}>{t("game.takebackRequested")}</div>
              )}
              {showDrawOffer && drawOfferer && drawOfferer !== userId && (
                <div className={styles['requestLabel']}>{t("game.drawOffered")}</div>
              )}
              <div className={styles['gameActions']}>
                {isBrowsingHistory && (
                  <button
                    type="button"
                    className={styles['backToCurrentBtn']}
                    onClick={() => setViewingPly(null)}
                    title={t("game.backToCurrent")}
                  >
                    &raquo;
                  </button>
                )}
                {undoRequester && undoRequester !== userId ? (
                  <>
                    <button
                      type="button"
                      className={`${styles['actionBtn']} ${styles['actionConfirm']}`}
                      onClick={() => socket.emit("game:undo-response", { roomId, accepted: true })}
                      title={t("game.acceptTakeback")}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className={`${styles['actionBtn']} ${styles['actionCancel']}`}
                      onClick={() => socket.emit("game:undo-response", { roomId, accepted: false })}
                      title={t("game.declineTakeback")}
                    >
                      ✗
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles['actionBtn']}
                    disabled={moves.length === 0 || undoPending}
                    onClick={() => {
                      setUndoPending(true);
                      socket.emit("game:undo-request", { roomId, userId, moveCount: moves.length });
                    }}
                    title={undoPending ? t("game.takebackPending") : t("game.takeback")}
                  >
                    ↶
                  </button>
                )}

                {showDrawOffer && (
                  <>
                    {drawOfferer && drawOfferer !== userId ? (
                      <>
                        <button
                          type="button"
                          className={`${styles['actionBtn']} ${styles['actionConfirm']}`}
                          onClick={() => socket.emit("game:draw-response", { roomId, userId, accepted: true })}
                          title={t("game.acceptDraw")}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className={`${styles['actionBtn']} ${styles['actionCancel']}`}
                          onClick={() => socket.emit("game:draw-response", { roomId, userId, accepted: false })}
                          title={t("game.declineDraw")}
                        >
                          ✗
                        </button>
                      </>
                    ) : drawConfirm ? (
                      <button
                        type="button"
                        className={`${styles['actionBtn']} ${styles['actionDrawArmed']}`}
                        onClick={confirmDrawOffer}
                        title={t("game.confirmDraw")}
                      >
                        ½
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles['actionBtn']}
                        disabled={drawOfferPending}
                        onClick={startDrawConfirm}
                        title={drawOfferPending ? t("game.drawPending") : t("game.offerDraw")}
                      >
                        ½
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className={`${styles['actionBtn']} ${resignConfirm ? styles['actionResignArmed'] : ""}`}
                  onClick={resignConfirm ? confirmResign : startResignConfirm}
                  title={resignConfirm ? t("game.confirmResign") : t("game.resign")}
                >
                  ⚑
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {showChat && isPlayer && status !== "waiting" && (
        <GameChat
          messages={chatMessages}
          onSend={(text) => {
            if (roomId) {
              socket.emit(
                "game:chat",
                { roomId, userId, text },
                () => {}
              );
            }
          }}
          userId={userId}
          displayName={displayName}
        />
      )}
    </div>
  );
}
