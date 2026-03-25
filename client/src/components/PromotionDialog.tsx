import { defaultPieces } from "react-chessboard";
import styles from "./PromotionDialog.module.css";

interface Props {
  color: "white" | "black";
  square: string;
  orientation: "white" | "black";
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}

const PIECE_KEYS: { key: "q" | "r" | "b" | "n"; suffix: string }[] = [
  { key: "q", suffix: "Q" },
  { key: "r", suffix: "R" },
  { key: "b", suffix: "B" },
  { key: "n", suffix: "N" },
];

export default function PromotionDialog({ color, square, orientation, onSelect, onCancel }: Props) {
  if (!square || square.length < 2) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square.charAt(1), 10);
  if (!Number.isFinite(rank)) return null;

  const col = orientation === "white" ? file : 7 - file;
  const promotesFromTop =
    (rank === 8 && orientation === "white") ||
    (rank === 1 && orientation === "black");

  const sqSize = 12.5;
  const prefix = color === "white" ? "w" : "b";

  return (
    <div className={styles['overlay']} onClick={onCancel}>
      {PIECE_KEYS.map((p, i) => {
        const PieceComponent = defaultPieces[`${prefix}${p.suffix}`];
        const topPct = promotesFromTop ? i * sqSize : (7 - i) * sqSize;
        return (
          <div
            key={p.key}
            className={styles['cell']}
            style={{
              left: `${col * sqSize}%`,
              top: `${topPct}%`,
              width: `${sqSize}%`,
              height: `${sqSize}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles['pieceBtn']} onClick={() => onSelect(p.key)}>
              <div className={styles['pieceImg']}>
                {PieceComponent && <PieceComponent />}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
