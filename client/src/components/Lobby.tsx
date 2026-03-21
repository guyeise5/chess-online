import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { socket } from "../socket";
import { RoomData, ColorChoice } from "../types";
import styles from "./Lobby.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
}

interface TimePreset {
  time: number;
  increment: number;
  label: string;
}

interface TimeCategory {
  name: string;
  presets: TimePreset[];
}

const TIME_CATEGORIES: TimeCategory[] = [
  {
    name: "Bullet",
    presets: [
      { time: 60, increment: 0, label: "1+0" },
      { time: 120, increment: 1, label: "2+1" },
    ],
  },
  {
    name: "Blitz",
    presets: [
      { time: 180, increment: 0, label: "3+0" },
      { time: 180, increment: 2, label: "3+2" },
      { time: 300, increment: 0, label: "5+0" },
      { time: 300, increment: 3, label: "5+3" },
    ],
  },
  {
    name: "Rapid",
    presets: [
      { time: 600, increment: 0, label: "10+0" },
      { time: 600, increment: 5, label: "10+5" },
      { time: 900, increment: 10, label: "15+10" },
    ],
  },
  {
    name: "Classical",
    presets: [
      { time: 1800, increment: 0, label: "30+0" },
      { time: 1800, increment: 20, label: "30+20" },
    ],
  },
];

const DEFAULT_PRESET = TIME_CATEGORIES[1].presets[2]; // 5+0

function formatTimeLabel(timeControl: number, increment: number): string {
  const mins = Math.floor(timeControl / 60);
  return `${mins}+${increment}`;
}

const COLOR_LABELS: Record<ColorChoice, string> = {
  white: "White",
  black: "Black",
  random: "Random",
};

export default function Lobby({ playerName, onChangeName }: Props) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<TimePreset>(DEFAULT_PRESET);
  const [colorChoice, setColorChoice] = useState<ColorChoice>("random");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const handleRoomsList = (data: RoomData[]) => setRooms(data);

    const handleGameStart = (room: RoomData) => {
      navigate(`/game/${room.roomId}`);
    };

    socket.on("rooms:list", handleRoomsList);
    socket.on("game:start", handleGameStart);
    socket.emit("rooms:list");

    return () => {
      socket.off("rooms:list", handleRoomsList);
      socket.off("game:start", handleGameStart);
    };
  }, [navigate]);

  const handleCreate = () => {
    setCreating(true);
    socket.emit(
      "room:create",
      { playerName, timeControl: selectedPreset.time, increment: selectedPreset.increment, colorChoice },
      (res: any) => {
        setCreating(false);
        if (res.success) {
          navigate(`/game/${res.room.roomId}`);
        }
      }
    );
  };

  const handleJoin = (roomId: string) => {
    socket.emit(
      "room:join",
      { roomId, playerName },
      (res: any) => {
        if (res.success) {
          navigate(`/game/${roomId}`);
        }
      }
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <img src="/favicon.png" alt="" className={styles.logoIcon} /> Chess
        </Link>
        <div className={styles.user}>
          <span className={styles.playerName}>{playerName}</span>
          <button className={styles.changeNameBtn} onClick={onChangeName}>
            Change
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Play Online</h2>
            <button
              className={styles.createBtn}
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? "Cancel" : "+ New Room"}
            </button>
          </div>

          {showCreate && (
            <div className={styles.createForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Time Control</label>
                <div className={styles.timeGrid}>
                  {TIME_CATEGORIES.map((cat) => (
                    <div key={cat.name} className={styles.timeCategory}>
                      <div className={styles.timeCategoryLabel}>
                        {cat.name}
                      </div>
                      <div className={styles.timePresets}>
                        {cat.presets.map((p) => (
                          <button
                            key={p.label}
                            className={`${styles.timePresetBtn} ${
                              selectedPreset.time === p.time && selectedPreset.increment === p.increment
                                ? styles.timePresetBtnActive
                                : ""
                            }`}
                            onClick={() => setSelectedPreset(p)}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Play as</label>
                <div className={styles.colorOptions}>
                  {(["white", "black", "random"] as ColorChoice[]).map((c) => (
                    <button
                      key={c}
                      className={`${styles.colorBtn} ${
                        colorChoice === c ? styles.colorBtnActive : ""
                      }`}
                      onClick={() => setColorChoice(c)}
                    >
                      {COLOR_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className={styles.submitBtn}
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create Room"}
              </button>
            </div>
          )}

          {rooms.length === 0 ? (
            <div className={styles.empty}>
              <p>No rooms available. Create one to start playing!</p>
            </div>
          ) : (
            <div className={styles.roomList}>
              {rooms.map((room) => (
                <div key={room.roomId} className={styles.roomCard}>
                  <div className={styles.roomInfo}>
                    <span className={styles.roomOwner}>{room.owner}</span>
                    <span className={styles.roomFormat}>
                      {formatTimeLabel(room.timeControl, room.increment)} &middot; {room.timeFormat}
                    </span>
                    <span className={styles.roomColor}>
                      Owner plays: {COLOR_LABELS[room.colorChoice]}
                    </span>
                  </div>
                  <button
                    className={styles.joinBtn}
                    onClick={() => handleJoin(room.roomId)}
                    disabled={room.owner === playerName}
                  >
                    {room.owner === playerName ? "Your Room" : "Join"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
