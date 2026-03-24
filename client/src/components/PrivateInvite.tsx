import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { defaultPieces } from "react-chessboard";
import { socket } from "../socket";
import { RoomData, ColorChoice } from "../types";
import { DEFAULT_PIECES, BLINDFOLD_PIECES } from "../boardThemes";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import NavBar from "./NavBar";
import styles from "./PrivateInvite.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
  onOpenSettings?: () => void;
  boardPrefs?: BoardPreferences;
}

function PieceImg({ piece, piecesName }: { piece: string; piecesName: string }) {
  if (piecesName === DEFAULT_PIECES || piecesName === BLINDFOLD_PIECES) {
    const Comp = defaultPieces[piece];
    return Comp ? <Comp /> : null;
  }
  return <img src={`/pieces/${piecesName}/${piece}.svg`} alt={piece} style={{ width: "100%", height: "100%" }} />;
}

function formatTimeLabel(timeControl: number, increment: number): string {
  const mins = timeControl / 60;
  const fmt = mins === 0.25 ? "¼" : mins === 0.5 ? "½" : String(mins);
  return `${fmt}+${increment}`;
}

function classifyTime(timeControl: number, increment: number): string {
  const total = timeControl + increment * 40;
  if (total < 29) return "UltraBullet";
  if (total < 180) return "Bullet";
  if (total < 480) return "Blitz";
  if (total < 1500) return "Rapid";
  return "Classical";
}

function colorLabel(choice: ColorChoice, ownerName: string, viewerName: string): string {
  if (choice === "random") return "Random";
  const ownerPlays = choice === "white" ? "White" : "Black";
  if (viewerName === ownerName) return ownerPlays;
  return ownerPlays === "White" ? "Black" : "White";
}

export default function PrivateInvite({ playerName, onChangeName, onOpenSettings, boardPrefs }: Props) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const piecesName = boardPrefs?.piecesName ?? DEFAULT_PIECES;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    socket.emit("room:info", { roomId }, (res: any) => {
      setLoading(false);
      if (res.success) {
        setRoom(res.room);
      } else {
        setNotFound(true);
      }
    });
  }, [roomId]);

  useEffect(() => {
    const handleGameStart = (startedRoom: RoomData) => {
      navigate(`/game/${startedRoom.roomId}`);
    };
    socket.on("game:start", handleGameStart);
    return () => { socket.off("game:start", handleGameStart); };
  }, [navigate]);

  useEffect(() => {
    if (!roomId) return;
    const handleRoomClosed = () => {
      setRoom(null);
      setNotFound(true);
    };
    socket.on("room:closed", handleRoomClosed);
    return () => { socket.off("room:closed", handleRoomClosed); };
  }, [roomId]);

  const handleAccept = useCallback(() => {
    if (!roomId || joining) return;
    setJoining(true);
    socket.emit("room:join", { roomId, playerName }, (res: any) => {
      if (res.success) {
        navigate(`/game/${roomId}`);
      } else {
        setJoining(false);
        if (res.error === "Room not found") {
          setRoom(null);
          setNotFound(true);
        }
      }
    });
  }, [roomId, playerName, joining, navigate]);

  const isOwner = room?.owner === playerName;
  const canAccept = room && room.status === "waiting" && !isOwner;
  const isPlaying = room?.status === "playing";
  const isFinished = room?.status === "finished";

  return (
    <div className={styles.container}>
      <NavBar playerName={playerName} onChangeName={onChangeName} onOpenSettings={onOpenSettings} />
      <div className={styles.main}>
        {loading ? (
          <div className={styles.card}>
            <span className={styles.loading}>Loading game info…</span>
          </div>
        ) : notFound ? (
          <div className={styles.card}>
            <div className={styles.notFound}>
              <span className={styles.notFoundIcon}>♔</span>
              <span className={styles.title}>Game not found</span>
              <span className={styles.notFoundText}>
                This private game no longer exists. The host may have left or the game has already started.
              </span>
              <Link to="/" className={styles.lobbyLink}>Go to Lobby</Link>
            </div>
          </div>
        ) : room ? (
          <div className={styles.card}>
            <span className={styles.title}>Private Game Invite</span>
            <span className={styles.owner}>
              Hosted by <span className={styles.ownerName}>{room.owner}</span>
            </span>

            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Time</span>
                <span className={styles.detailValue}>
                  {formatTimeLabel(room.timeControl, room.increment)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Mode</span>
                <span className={styles.detailValue} style={{ fontFamily: "inherit", textTransform: "capitalize" }}>
                  {classifyTime(room.timeControl, room.increment)}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Color</span>
                <span className={styles.colorValue}>
                  {room.colorChoice === "random" ? (
                    <>
                      <div className={styles.colorIcon}>
                        <div className={styles.halfPiece}>
                          <div className={styles.halfLeft}><PieceImg piece="wK" piecesName={piecesName} /></div>
                          <div className={styles.halfRight}><PieceImg piece="bK" piecesName={piecesName} /></div>
                        </div>
                      </div>
                      Random
                    </>
                  ) : (
                    <>
                      <div className={styles.colorIcon}>
                        <PieceImg
                          piece={colorLabel(room.colorChoice, room.owner, playerName) === "White" ? "wK" : "bK"}
                          piecesName={piecesName}
                        />
                      </div>
                      You play {colorLabel(room.colorChoice, room.owner, playerName)}
                    </>
                  )}
                </span>
              </div>
            </div>

            {canAccept && (
              <button
                className={styles.acceptBtn}
                onClick={handleAccept}
                disabled={joining}
              >
                {joining ? "Joining…" : "Accept & Play"}
              </button>
            )}

            {isOwner && room.status === "waiting" && (
              <span className={styles.statusTag}>Waiting for opponent…</span>
            )}

            {isPlaying && (
              <span className={`${styles.statusTag} ${styles.statusPlaying}`}>Game in progress</span>
            )}

            {isFinished && (
              <span className={`${styles.statusTag} ${styles.statusFinished}`}>Game finished</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
