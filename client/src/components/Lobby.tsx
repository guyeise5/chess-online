import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { defaultPieces } from "react-chessboard";
import { socket } from "../socket";
import { RoomData, ColorChoice, SocketResult, RoomResult, getEnv } from "../types";
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
  const mins = timeControl / 60;
  return `${formatMinutes(mins)}+${increment}`;
}

function classifyTime(minutes: number, increment: number): string {
  const total = minutes * 60 + increment * 40;
  if (total < 29) return "UltraBullet";
  if (total < 180) return "Bullet";
  if (total < 480) return "Blitz";
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
  const [colorChoice, setColorChoice] = useState<ColorChoice>(() => {
    const saved = localStorage.getItem("lobby:colorChoice");
    return saved === "white" || saved === "black" || saved === "random" ? saved : "random";
  });
  const [showCustom, setShowCustom] = useState(false);
  const [customMinIdx, setCustomMinIdx] = useState(() => {
    const saved = parseInt(localStorage.getItem("lobby:customMinIdx") ?? "", 10);
    return !isNaN(saved) && saved >= 0 && saved < MINUTE_STEPS.length ? saved : MINUTE_STEPS.indexOf(5);
  });
  const [customIncIdx, setCustomIncIdx] = useState(() => {
    const saved = parseInt(localStorage.getItem("lobby:customIncIdx") ?? "", 10);
    return !isNaN(saved) && saved >= 0 && saved < INCREMENT_STEPS.length ? saved : INCREMENT_STEPS.indexOf(3);
  });

  const [waitingRoomId, setWaitingRoomId] = useState<string | null>(null);
  const [waitingPreset, setWaitingPreset] = useState<string | null>(null);
  const waitingTimeRef = useRef<{ time: number; increment: number } | null>(null);
  const waitingRoomIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const [showPrivate, setShowPrivate] = useState(false);
  const [privateRoomId, setPrivateRoomId] = useState<string | null>(null);
  const [privateBusy, setPrivateBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const privateRoomIdRef = useRef<string | null>(null);
  privateRoomIdRef.current = privateRoomId;

  const privateGamesEnabled = getEnv().FEATURE_PRIVATE_GAMES !== "false";

  waitingRoomIdRef.current = waitingRoomId;

  const customMinutes = MINUTE_STEPS[customMinIdx] ?? 5;
  const customIncrement = INCREMENT_STEPS[customIncIdx] ?? 3;

  useEffect(() => {
    const handleRoomsList = (data: RoomData[]) => setRooms(Array.isArray(data) ? data : []);
    const handleGameStart = (room: RoomData) => {
      if (room?.roomId) navigate(`/game/${room.roomId}`);
    };

    socket.on("rooms:list", handleRoomsList);
    socket.on("game:start", handleGameStart);
    socket.emit("rooms:list");

    return () => {
      socket.off("rooms:list", handleRoomsList);
      socket.off("game:start", handleGameStart);
      if (waitingRoomIdRef.current) {
        socket.emit("room:leave", { roomId: waitingRoomIdRef.current, playerName }, () => {});
      }
      if (privateRoomIdRef.current) {
        socket.emit("room:leave", { roomId: privateRoomIdRef.current, playerName }, () => {});
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
          (res: RoomResult) => {
            busyRef.current = false;
            if (res?.success && res.room?.roomId) {
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
      localStorage.setItem("lobby:colorChoice", newColor);
      if (waitingPreset && waitingTimeRef.current) {
        const { time, increment } = waitingTimeRef.current;
        openRoom(time, increment, waitingPreset, newColor);
      }
    },
    [waitingPreset, openRoom]
  );

  const handleJoin = useCallback(
    (roomId: string) => {
      socket.emit("room:join", { roomId, playerName }, (res: SocketResult) => {
        if (res?.success) navigate(`/game/${roomId}`);
      });
    },
    [playerName, navigate]
  );

  const closePrivateRoom = useCallback(() => {
    if (privateRoomIdRef.current) {
      socket.emit("room:leave", { roomId: privateRoomIdRef.current, playerName }, () => {});
      setPrivateRoomId(null);
    }
  }, [playerName]);

  const handleClosePrivateModal = useCallback(() => {
    closePrivateRoom();
    setShowPrivate(false);
    setCopied(false);
  }, [closePrivateRoom]);

  const handleCreatePrivate = useCallback(
    (timeControl: number, increment: number) => {
      if (privateBusy) return;
      setPrivateBusy(true);
      setCopied(false);

      const doCreate = () => {
        socket.emit(
          "room:create",
          { playerName, timeControl, increment, colorChoice: colorChoice, isPrivate: true },
          (res: RoomResult) => {
            setPrivateBusy(false);
            if (res?.success && res.room?.roomId) {
              setPrivateRoomId(res.room.roomId);
            }
          }
        );
      };

      if (privateRoomIdRef.current) {
        const oldId = privateRoomIdRef.current;
        setPrivateRoomId(null);
        socket.emit("room:leave", { roomId: oldId, playerName }, () => doCreate());
      } else {
        doCreate();
      }
    },
    [playerName, colorChoice, privateBusy]
  );

  const privateInviteUrl = privateRoomId
    ? `${window.location.origin}/invite/${privateRoomId}`
    : "";

  const handleCopyLink = useCallback(() => {
    if (!privateInviteUrl) return;
    const fallbackCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = privateInviteUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(privateInviteUrl).then(
        () => {},
        () => fallbackCopy()
      );
    } else {
      fallbackCopy();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [privateInviteUrl]);

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
                  <span className={styles.presetTime}>{p.label}</span>
                  <span className={styles.presetCategory}>{classifyTime(p.time / 60, p.increment)}</span>
                </button>
              ))}
              <button
                className={`${styles.presetBtn} ${showCustom ? styles.presetBtnActive : ""} ${isCustomWaiting ? styles.presetBtnWaiting : ""}`}
                onClick={() => setShowCustom(!showCustom)}
              >
                <span className={styles.presetTime}>Custom</span>
              </button>
            </div>

            {privateGamesEnabled && (
              <button
                className={styles.privateBtn}
                onClick={() => setShowPrivate(true)}
              >
                Create Private Game
              </button>
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

      {showPrivate && privateGamesEnabled && (
        <div className={styles.customOverlay} onClick={handleClosePrivateModal}>
          <div className={styles.customModal} onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
            <div className={styles.customModalHeader}>
              <span className={styles.customModalTitle}>Create private game</span>
              <button className={styles.customCloseBtn} onClick={handleClosePrivateModal}>✕</button>
            </div>

            {!privateRoomId ? (
              <>
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

                <div className={styles.privatePresetGrid}>
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      className={styles.privatePresetBtn}
                      onClick={() => handleCreatePrivate(p.time, p.increment)}
                      disabled={privateBusy}
                    >
                      <span className={styles.presetTime}>{p.label}</span>
                      <span className={styles.presetCategory}>{classifyTime(p.time / 60, p.increment)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.privateLinkSection}>
                <div className={styles.privateLinkLabel}>Share this link with your opponent:</div>
                <div className={styles.privateLinkRow}>
                  <input
                    className={styles.privateLinkInput}
                    value={privateInviteUrl}
                    readOnly
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button className={styles.privateCopyBtn} onClick={handleCopyLink} title={copied ? "Copied!" : "Copy link"}>
                    {copied ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                  </button>
                </div>
                <div className={styles.privateWaiting}>Waiting for opponent…</div>
                <button className={styles.privateCancelBtn} onClick={handleClosePrivateModal}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCustom && (
        <div className={styles.customOverlay} onClick={() => setShowCustom(false)}>
          <div className={styles.customModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.customModalHeader}>
              <span className={styles.customModalTitle}>Custom time control</span>
              <button className={styles.customCloseBtn} onClick={() => setShowCustom(false)}>✕</button>
            </div>
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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCustomMinIdx(v);
                  localStorage.setItem("lobby:customMinIdx", String(v));
                }}
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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCustomIncIdx(v);
                  localStorage.setItem("lobby:customIncIdx", String(v));
                }}
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
        </div>
      )}
    </div>
  );
}
