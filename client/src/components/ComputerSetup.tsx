import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultPieces } from "react-chessboard";
import { STOCKFISH_LEVELS } from "../hooks/useStockfish";
import NavBar from "./NavBar";
import styles from "./ComputerSetup.module.css";

const WhiteKing = defaultPieces["wK"];
const BlackKing = defaultPieces["bK"];

interface Props {
  playerName: string;
  onChangeName: () => void;
}

export default function ComputerSetup({ playerName, onChangeName }: Props) {
  const navigate = useNavigate();
  const [color, setColor] = useState<"white" | "black" | "random">("white");

  const handlePlay = (level: number) => {
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
      <NavBar playerName={playerName} onChangeName={onChangeName} />

      <main className={styles.main}>
        <div className={styles.setupPanel}>
          <div className={styles.colorRow}>
            <button
              className={`${styles.colorOption} ${color === "white" ? styles.colorOptionActive : ""}`}
              onClick={() => setColor("white")}
              title="White"
            >
              <div className={styles.pieceIcon}>{WhiteKing && <WhiteKing />}</div>
            </button>
            <button
              className={`${styles.colorOption} ${color === "random" ? styles.colorOptionActive : ""}`}
              onClick={() => setColor("random")}
              title="Random"
            >
              <div className={styles.pieceIcon}>
                <div className={styles.halfPieceWrap}>
                  <div className={styles.halfLeft}>{WhiteKing && <WhiteKing />}</div>
                  <div className={styles.halfRight}>{BlackKing && <BlackKing />}</div>
                </div>
              </div>
            </button>
            <button
              className={`${styles.colorOption} ${color === "black" ? styles.colorOptionActive : ""}`}
              onClick={() => setColor("black")}
              title="Black"
            >
              <div className={styles.pieceIcon}>{BlackKing && <BlackKing />}</div>
            </button>
          </div>

          <div className={styles.levelGrid}>
            {STOCKFISH_LEVELS.map((l) => (
              <button
                key={l.level}
                className={styles.levelBtn}
                onClick={() => handlePlay(l.level)}
              >
                <span className={styles.levelNum}>{l.level}</span>
                <span className={styles.levelRating}>{l.rating}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
