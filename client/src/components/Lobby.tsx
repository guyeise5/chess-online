import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { socket } from "../socket";
import { RoomData, TimeFormat, ColorChoice } from "../types";
import styles from "./Lobby.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
}

const TIME_FORMAT_LABELS: Record<TimeFormat, string> = {
  bullet: "Bullet (1 min)",
  blitz: "Blitz (5 min)",
  rapid: "Rapid (10 min)",
  classical: "Classical (30 min)",
};

const COLOR_LABELS: Record<ColorChoice, string> = {
  white: "White",
  black: "Black",
  random: "Random",
};

export default function Lobby({ playerName, onChangeName }: Props) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("blitz");
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
      { playerName, timeFormat, colorChoice },
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
        <h1 className={styles.logo}><img src="/favicon.png" alt="" className={styles.logoIcon} /> Chess</h1>
        <Link to="/puzzles" className={styles.puzzlesLink}>
          <span className={styles.puzzlesIcon}>&#129513;</span>
          Puzzles
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
            <h2>Available Rooms</h2>
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
                <label className={styles.label}>Time Format</label>
                <select
                  className={styles.select}
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value as TimeFormat)}
                >
                  {Object.entries(TIME_FORMAT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
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
                      {TIME_FORMAT_LABELS[room.timeFormat]}
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
