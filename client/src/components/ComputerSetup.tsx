import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultPieces } from "react-chessboard";
import { STOCKFISH_LEVELS } from "../hooks/useStockfish";
import { DEFAULT_PIECES, BLINDFOLD_PIECES } from "../boardThemes";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import { useUserPrefs } from "../hooks/useUserPreferences";
import NavBar from "./NavBar";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./ComputerSetup.module.css";

function PieceImg({ piece, piecesName }: { piece: string; piecesName: string }) {
  if (piecesName === DEFAULT_PIECES || piecesName === BLINDFOLD_PIECES) {
    const Comp = defaultPieces[piece];
    return Comp ? <Comp /> : null;
  }
  return <img src={`/pieces/${piecesName}/${piece}.svg`} alt={piece} style={{ width: "100%", height: "100%" }} />;
}

interface Props {
  userId: string;
  displayName: string;
  onChangeName?: () => void;
  onOpenSettings?: () => void;
  boardPrefs?: BoardPreferences;
}

export default function ComputerSetup({ userId, displayName, onChangeName, onOpenSettings, boardPrefs }: Props) {
  void userId;
  const { t } = useI18n();
  const navigate = useNavigate();
  const { prefs: userPrefs, update: updatePrefs } = useUserPrefs();
  const piecesName = boardPrefs?.piecesName ?? DEFAULT_PIECES;
  const [color, setColor] = useState<"white" | "black" | "random">(() => {
    const saved = userPrefs.computerColor;
    return saved === "white" || saved === "black" || saved === "random" ? saved : "white";
  });

  const handlePlay = (level: number) => {
    const actualColor = color === "random"
      ? (Math.random() < 0.5 ? "white" : "black")
      : color;
    navigate("/play/computer", {
      state: { level, color: actualColor },
    });
  };

  return (
    <div className={styles['container']}>
      <NavBar
        displayName={displayName}
        {...(onChangeName ? { onChangeName } : {})}
        {...(onOpenSettings ? { onOpenSettings } : {})}
      />

      <main className={styles['main']}>
        <div className={styles['setupPanel']}>
          <div className={styles['colorRow']}>
            <button
              className={`${styles['colorOption']} ${color === "white" ? styles['colorOptionActive'] : ""}`}
              onClick={() => { setColor("white"); updatePrefs({ computerColor: "white" }); }}
              title={t("color.white")}
            >
              <div className={styles['pieceIcon']}><PieceImg piece="wK" piecesName={piecesName} /></div>
            </button>
            <button
              className={`${styles['colorOption']} ${color === "random" ? styles['colorOptionActive'] : ""}`}
              onClick={() => { setColor("random"); updatePrefs({ computerColor: "random" }); }}
              title={t("color.random")}
            >
              <div className={styles['pieceIcon']}>
                <div className={styles['halfPieceWrap']}>
                  <div className={styles['halfLeft']}><PieceImg piece="wK" piecesName={piecesName} /></div>
                  <div className={styles['halfRight']}><PieceImg piece="bK" piecesName={piecesName} /></div>
                </div>
              </div>
            </button>
            <button
              className={`${styles['colorOption']} ${color === "black" ? styles['colorOptionActive'] : ""}`}
              onClick={() => { setColor("black"); updatePrefs({ computerColor: "black" }); }}
              title={t("color.black")}
            >
              <div className={styles['pieceIcon']}><PieceImg piece="bK" piecesName={piecesName} /></div>
            </button>
          </div>

          <div className={styles['levelGrid']}>
            {STOCKFISH_LEVELS.map((l) => (
              <button
                key={l.level}
                className={styles['levelBtn']}
                onClick={() => handlePlay(l.level)}
              >
                <span className={styles['levelNum']}>{l.level}</span>
                <span className={styles['levelRating']}>{l.rating}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
