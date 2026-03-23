import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { defaultPieces } from "react-chessboard";
import { socket } from "../socket";
import { RoomData, ColorChoice } from "../types";
import { DEFAULT_PIECES, BLINDFOLD_PIECES } from "../boardThemes";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import NavBar from "./NavBar";
import styles from "./Lobby.module.css";

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

const PRESETS = [
  { time: 60, increment: 0, label: "1+0" },
  { time: 120, increment: 1, label: "2+1" },
  { time: 180, increment: 0, label: "3+0" },
  { time: 180, increment: 2, label: "3+2" },
  { time: 300, increment: 0, label: "5+0" },
  { time: 300, increment: 3, label: "5+3" },
  { time: 600, increment: 0, label: "10+0" },
  { time: 600, increment: 5, label: "10+5" },
  { time: 900, increment: 10, label: "15+10" },
  { time: 1800, increment: 0, label: "30+0" },
  { time: 1800, increment: 20, label: "30+20" },
];

const MINUTE_STEPS = [0, 0.25, 0.5, ...Array.from({ length: 180 }, (_, i) => i + 1)];
const INCREMENT_STEPS = Array.from({ length: 181 }, (_, i) => i);

function formatMinutes(v: number): string {
  if (v === 0.25) return "¼";
  if (v === 0.5) return "½";
  return String(v);
}

function formatTimeLabel(timeControl: number, increment: number): string {
  const mins = Math.floor(timeControl / 60);
  return `${mins}+${increment}`;
}

function classifyTime(minutes: number, increment: number): string {
  const total = minutes * 60 + increment * 40;
  if (total < 30) return "UltraBullet";
  if (total < 120) return "UltraBullet";
  if (total < 300) return "Bullet";
  if (total < 600) return "Blitz";
  if (total < 1500) return "Rapid";
  return "Classical";
}

function ColorIcon({ choice, piecesName }: { choice: ColorChoice; piecesName: string }) {
  if (choice === "white") return <div className={styles.colorIconWrap}><PieceImg piece="wK" piecesName={piecesName} /></div>;
  if (choice === "black") return <div className={styles.colorIconWrap}><PieceImg piece="bK" piecesName={piecesName} /></div>;
  return (
    <div className={styles.colorIconWrap}>
      <div className={styles.halfPieceSmall}>
        <div className={styles.halfSmallLeft}><PieceImg piece="wK" piecesName={piecesName} /></div>
        <div className={styles.halfSmallRight}><PieceImg piece="bK" piecesName={piecesName} /></div>
      </div>
    </div>
  );
}

export default function Lobby({ playerName, onChangeName, onOpenSettings, boardPrefs }: Props) {
  const navigate = useNavigate();
  const piecesName = boardPrefs?.piecesName ?? DEFAULT_PIECES;
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [colorChoice, setColorChoice] = useState<ColorChoice>("random");
  const [showCustom, setShowCustom] = useState(false);
  const [customMinIdx, setCustomMinIdx] = useState(MINUTE_STEPS.indexOf(5));
  const [customIncIdx, setCustomIncIdx] = useState(INCREMENT_STEPS.indexOf(3));

  const [waitingRoomId, setWaitingRoomId] = useState<string | null>(null);
  const [waitingPreset, setWaitingPreset] = useState<string | null>(null);
  const waitingTimeRef = useRef<{ time: number; increment: number } | null>(null);
  const waitingRoomIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  waitingRoomIdRef.current = waitingRoomId;

  const customMinutes = MINUTE_STEPS[customMinIdx] ?? 5;
  const customIncrement = INCREMENT_STEPS[customIncIdx] ?? 3;

  useEffect(() => {
    const handleRoomsList = (data: RoomData[]) => setRooms(data);
    const handleGameStart = (room: RoomData) => navigate(`/game/${room.roomId}`);

    socket.on("rooms:list", handleRoomsList);
    socket.on("game:start", handleGameStart);
    socket.emit("rooms:list");

    return () => {
      socket.off("rooms:list", handleRoomsList);
      socket.off("game:start", handleGameStart);
      if (waitingRoomIdRef.current) {
        socket.emit("room:leave", { roomId: waitingRoomIdRef.current, playerName });
      }
    };
  }, [navigate, playerName]);

  const closeRoom = useCallback(
    (roomId: string): Promise<void> =>
      new Promise((resolve) => {
        socket.emit("room:leave", { roomId, playerName }, () => resolve());
      }),
    [playerName]
  );

  const openRoom = useCallback(
    (timeControl: number, increment: number, presetKey: string, color: ColorChoice) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const doCreate = () => {
        socket.emit(
          "room:create",
          { playerName, timeControl, increment, colorChoice: color },
          (res: any) => {
            busyRef.current = false;
            if (res.success) {
              setWaitingRoomId(res.room.roomId);
              setWaitingPreset(presetKey);
              waitingTimeRef.current = { time: timeControl, increment };
            }
          }
        );
      };

      if (waitingRoomId) {
        const oldId = waitingRoomId;
        setWaitingRoomId(null);
        setWaitingPreset(null);
        closeRoom(oldId).then(doCreate);
      } else {
        doCreate();
      }
    },
    [playerName, waitingRoomId, closeRoom]
  );

  const handlePresetClick = useCallback(
    (p: (typeof PRESETS)[number]) => {
      setShowCustom(false);
      if (waitingPreset === p.label) {
        const oldId = waitingRoomId;
        setWaitingRoomId(null);
        setWaitingPreset(null);
        waitingTimeRef.current = null;
        if (oldId) closeRoom(oldId);
        return;
      }
      openRoom(p.time, p.increment, p.label, colorChoice);
    },
    [waitingPreset, waitingRoomId, closeRoom, openRoom, colorChoice]
  );

  const handleCustomCreate = useCallback(() => {
    const timeSec = Math.round(customMinutes * 60);
    const key = `custom:${customMinutes}+${customIncrement}`;
    openRoom(timeSec, customIncrement, key, colorChoice);
  }, [customMinutes, customIncrement, openRoom, colorChoice]);

  const handleColorChange = useCallback(
    (newColor: ColorChoice) => {
      setColorChoice(newColor);
      if (waitingPreset && waitingTimeRef.current) {
        const { time, increment } = waitingTimeRef.current;
        openRoom(time, increment, waitingPreset, newColor);
      }
    },
    [waitingPreset, openRoom]
  );

  const handleJoin = useCallback(
    (roomId: string) => {
      socket.emit("room:join", { roomId, playerName }, (res: any) => {
        if (res.success) navigate(`/game/${roomId}`);
      });
    },
    [playerName, navigate]
  );

  const customLabel = useMemo(
    () => `${formatMinutes(customMinutes)}+${customIncrement}`,
    [customMinutes, customIncrement]
  );
  const customCategory = useMemo(
    () => classifyTime(customMinutes, customIncrement),
    [customMinutes, customIncrement]
  );

  const isCustomWaiting = waitingPreset?.startsWith("custom:");

  return (
    <div className={styles.container}>
      <NavBar playerName={playerName} onChangeName={onChangeName} onOpenSettings={onOpenSettings} />

      <main className={styles.main}>
        <div className={styles.layout}>
          {/* Left: Game setup */}
          <div className={styles.setupPanel}>
            <div className={styles.colorRow}>
              <button
                className={`${styles.colorOption} ${colorChoice === "white" ? styles.colorOptionActive : ""}`}
                onClick={() => handleColorChange("white")}
                title="White"
              >
                <div className={styles.pieceIcon}><PieceImg piece="wK" piecesName={piecesName} /></div>
              </button>
              <button
                className={`${styles.colorOption} ${colorChoice === "random" ? styles.colorOptionActive : ""}`}
                onClick={() => handleColorChange("random")}
                title="Random"
              >
                <div className={styles.pieceIcon}>
                  <div className={styles.halfPieceWrap}>
                    <div className={styles.halfLeft}><PieceImg piece="wK" piecesName={piecesName} /></div>
                    <div className={styles.halfRight}><PieceImg piece="bK" piecesName={piecesName} /></div>
                  </div>
                </div>
              </button>
              <button
                className={`${styles.colorOption} ${colorChoice === "black" ? styles.colorOptionActive : ""}`}
                onClick={() => handleColorChange("black")}
                title="Black"
              >
                <div className={styles.pieceIcon}><PieceImg piece="bK" piecesName={piecesName} /></div>
              </button>
            </div>

            <div className={styles.presetGrid}>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  className={`${styles.presetBtn} ${waitingPreset === p.label ? styles.presetBtnWaiting : ""}`}
                  onClick={() => handlePresetClick(p)}
                >
                  {p.label}
                </button>
              ))}
              <button
                className={`${styles.presetBtn} ${showCustom ? styles.presetBtnActive : ""} ${isCustomWaiting ? styles.presetBtnWaiting : ""}`}
                onClick={() => setShowCustom(!showCustom)}
              >
                Custom
              </button>
            </div>

            {showCustom && (
              <div className={styles.customPopup}>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <span className={styles.sliderLabel}>Minutes</span>
                    <span className={styles.sliderValue}>{formatMinutes(customMinutes)}</span>
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={MINUTE_STEPS.length - 1}
                    value={customMinIdx}
                    onChange={(e) => setCustomMinIdx(Number(e.target.value))}
                  />
                </div>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <span className={styles.sliderLabel}>Increment</span>
                    <span className={styles.sliderValue}>{customIncrement}s</span>
                  </div>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={INCREMENT_STEPS.length - 1}
                    value={customIncIdx}
                    onChange={(e) => setCustomIncIdx(Number(e.target.value))}
                  />
                </div>
                <button
                  className={`${styles.customCreateBtn} ${isCustomWaiting ? styles.customCreateBtnWaiting : ""}`}
                  onClick={handleCustomCreate}
                  disabled={customMinutes === 0 && customIncrement === 0}
                >
                  {isCustomWaiting
                    ? `Waiting… ${customLabel} ${customCategory}`
                    : `Create lobby ${customLabel} ${customCategory}`}
                </button>
              </div>
            )}
          </div>

          {/* Right: Room list table */}
          <div className={styles.tablePanel}>
            <div className={styles.tableHeader}>
              <span className={styles.thPlayer}>Player</span>
              <span className={styles.thTime}>Time</span>
              <span className={styles.thMode}>Mode</span>
            </div>

            {rooms.length === 0 ? (
              <div className={styles.empty}>No open games right now</div>
            ) : (
              <div className={styles.tableBody}>
                {rooms.map((room) => {
                  const isOwn = room.owner === playerName;
                  return (
                    <div
                      key={room.roomId}
                      className={`${styles.tableRow} ${isOwn ? styles.tableRowOwn : ""}`}
                      onClick={() => !isOwn && handleJoin(room.roomId)}
                      role={!isOwn ? "button" : undefined}
                      tabIndex={!isOwn ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isOwn) handleJoin(room.roomId);
                      }}
                    >
                      <span className={styles.tdPlayer}>
                        <ColorIcon choice={room.colorChoice} piecesName={piecesName} />
                        {room.owner}
                        {isOwn && <span className={styles.youTag}>you</span>}
                      </span>
                      <span className={styles.tdTime}>
                        {formatTimeLabel(room.timeControl, room.increment)}
                      </span>
                      <span className={styles.tdMode}>{room.timeFormat}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
