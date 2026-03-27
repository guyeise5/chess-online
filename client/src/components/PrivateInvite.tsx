import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { defaultPieces } from "react-chessboard";
import { socket } from "../socket";
import { RoomData, ColorChoice, SocketResult, RoomResult } from "../types";
import { DEFAULT_PIECES, BLINDFOLD_PIECES } from "../boardThemes";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import NavBar from "./NavBar";
import { useI18n } from "../i18n/I18nProvider";
import { timeFormatToKey } from "../i18n/timeCategory";
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

function colorPieceLabel(
  choice: ColorChoice,
  ownerName: string,
  viewerName: string,
  t: (key: string) => string
): string {
  if (choice === "random") return t("color.random");
  const ownerPlays = choice === "white" ? t("color.white") : t("color.black");
  if (viewerName === ownerName) return ownerPlays;
  return choice === "white" ? t("color.black") : t("color.white");
}

export default function PrivateInvite({ playerName, onChangeName, onOpenSettings, boardPrefs }: Props) {
  const { t } = useI18n();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const piecesName = boardPrefs?.piecesName ?? DEFAULT_PIECES;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    socket.emit("room:info", { roomId }, (res: RoomResult) => {
      setLoading(false);
      if (res?.success && res.room) {
        setRoom(res.room);
      } else {
        setNotFound(true);
      }
    });
  }, [roomId]);

  useEffect(() => {
    const handleGameStart = (startedRoom: RoomData) => {
      if (startedRoom?.roomId) navigate(`/game/${startedRoom.roomId}`);
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
    socket.emit("room:join", { roomId, playerName }, (res: SocketResult) => {
      if (res?.success) {
        navigate(`/game/${roomId}`);
      } else {
        setJoining(false);
        if (res?.error === "Room not found") {
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
    <div className={styles['container']}>
      <NavBar playerName={playerName} onChangeName={onChangeName} {...(onOpenSettings ? { onOpenSettings } : {})} />
      <div className={styles['main']}>
        {loading ? (
          <div className={styles['card']}>
            <span className={styles['loading']}>{t("invite.loadingInfo")}</span>
          </div>
        ) : notFound ? (
          <div className={styles['card']}>
            <div className={styles['notFound']}>
              <span className={styles['notFoundIcon']}>♔</span>
              <span className={styles['title']}>{t("invite.notFound")}</span>
              <span className={styles['notFoundText']}>
                {t("invite.privateGone")}
              </span>
              <Link to="/" className={styles['lobbyLink']}>{t("invite.goLobby")}</Link>
            </div>
          </div>
        ) : room ? (
          <div className={styles['card']}>
            <span className={styles['title']}>{t("invite.inviteTitle")}</span>
            <span className={styles['owner']}>
              {t("invite.hostedBy")} <span className={styles['ownerName']}>{room.owner}</span>
            </span>

            <div className={styles['details']}>
              <div className={styles['detailRow']}>
                <span className={styles['detailLabel']}>{t("invite.time")}</span>
                <span className={styles['detailValue']}>
                  {formatTimeLabel(room.timeControl, room.increment)}
                </span>
              </div>
              <div className={styles['detailRow']}>
                <span className={styles['detailLabel']}>{t("invite.mode")}</span>
                <span className={styles['detailValue']} style={{ fontFamily: "inherit", textTransform: "capitalize" }}>
                  {t(timeFormatToKey(room.timeFormat))}
                </span>
              </div>
              <div className={styles['detailRow']}>
                <span className={styles['detailLabel']}>{t("invite.color")}</span>
                <span className={styles['colorValue']}>
                  {room.colorChoice === "random" ? (
                    <>
                      <div className={styles['colorIcon']}>
                        <div className={styles['halfPiece']}>
                          <div className={styles['halfLeft']}><PieceImg piece="wK" piecesName={piecesName} /></div>
                          <div className={styles['halfRight']}><PieceImg piece="bK" piecesName={piecesName} /></div>
                        </div>
                      </div>
                      {t("invite.random")}
                    </>
                  ) : (
                    <>
                      <div className={styles['colorIcon']}>
                        <PieceImg
                          piece={colorPieceLabel(room.colorChoice, room.owner, playerName, t) === t("color.white") ? "wK" : "bK"}
                          piecesName={piecesName}
                        />
                      </div>
                      {t("invite.youPlay")} {colorPieceLabel(room.colorChoice, room.owner, playerName, t)}
                    </>
                  )}
                </span>
              </div>
            </div>

            {canAccept && (
              <button
                type="button"
                className={styles['acceptBtn']}
                onClick={handleAccept}
                disabled={joining}
              >
                {joining ? t("invite.joining") : t("invite.accept")}
              </button>
            )}

            {isOwner && room.status === "waiting" && (
              <span className={styles['statusTag']}>{t("invite.waitingOwner")}</span>
            )}

            {isPlaying && (
              <span className={`${styles['statusTag']} ${styles['statusPlaying']}`}>{t("invite.inProgress")}</span>
            )}

            {isFinished && (
              <span className={`${styles['statusTag']} ${styles['statusFinished']}`}>{t("invite.finishedShort")}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
