import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { STOCKFISH_LEVELS } from "../hooks/useStockfish";
import styles from "./ComputerSetup.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
}

const COLOR_LABELS: Record<string, string> = {
  white: "White",
  black: "Black",
  random: "Random",
};

export default function ComputerSetup({ playerName, onChangeName }: Props) {
  const navigate = useNavigate();
  const [level, setLevel] = useState(3);
  const [color, setColor] = useState<"white" | "black" | "random">("white");

  const handlePlay = () => {
    const actualColor = color === "random"
      ? (Math.random() < 0.5 ? "white" : "black")
      : color;
    localStorage.removeItem("chess-computer-game");
    navigate("/play/computer", {
      state: { level, color: actualColor },
    });
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
          <h2 className={styles.title}>Play vs Computer</h2>

          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Stockfish Level</label>
              <div className={styles.levelGrid}>
                {STOCKFISH_LEVELS.map((l) => (
                  <button
                    key={l.level}
                    className={`${styles.levelBtn} ${level === l.level ? styles.levelBtnActive : ""}`}
                    onClick={() => setLevel(l.level)}
                  >
                    <span className={styles.levelNum}>{l.level}</span>
                    <span className={styles.levelRating}>{l.rating}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Play as</label>
              <div className={styles.colorOptions}>
                {(["white", "black", "random"] as const).map((c) => (
                  <button
                    key={c}
                    className={`${styles.colorBtn} ${color === c ? styles.colorBtnActive : ""}`}
                    onClick={() => setColor(c)}
                  >
                    {COLOR_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <button className={styles.playBtn} onClick={handlePlay}>
              Play
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
