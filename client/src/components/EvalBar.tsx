import type { CSSProperties } from "react";
import styles from "./EvalBar.module.css";

interface Props {
  score: number;
  orientation: "white" | "black";
}

export function evalWhitePercent(score: number): number {
  if (score >= 9900) return 96;
  if (score <= -9900) return 4;
  const raw = 50 + 50 * (2 / (1 + Math.exp(-score / 400)) - 1);
  return Math.min(96, Math.max(4, raw));
}

export function formatEvalLabel(score: number): string {
  const abs = Math.abs(score);
  if (abs >= 9900) {
    const mateDist = 10000 - abs;
    if (mateDist <= 0) return "#";
    return `M${mateDist}`;
  }
  return (abs / 100).toFixed(1);
}

export default function EvalBar({ score, orientation }: Props) {
  const whitePercent = evalWhitePercent(score);
  const label = formatEvalLabel(score);
  const whiteAdv = score >= 0;

  const bottomIsWhite = orientation === "white";
  const labelClass = [styles.label, styles.labelBottom];
  const labelStyle: CSSProperties = {
    color: bottomIsWhite ? "#403d39" : "#e8e6e1",
  };

  return (
    <div
      className={`${styles.container} ${orientation === "black" ? styles.containerFlipped : ""}`}
      aria-label={`Evaluation ${label}`}
    >
      <div
        className={styles.whiteSide}
        style={{ height: `${whitePercent}%` }}
      />
      <div className={labelClass.join(" ")} style={labelStyle}>
        {label === "#" ? label : `${score >= 0 ? "+" : "\u2212"}${label}`}
      </div>
    </div>
  );
}
