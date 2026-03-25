import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./Introduction.module.css";

interface Props {
  onComplete: () => void;
}

interface Step {
  title: string;
  content: React.ReactNode;
  selector?: string;
  position?: "bottom" | "top" | "left" | "right";
}

const STEPS: Step[] = [
  {
    title: "Welcome to Chess Online",
    content: (
      <>
        <p>A real-time multiplayer chess platform where you can play against other players, challenge the computer, and solve puzzles.</p>
        <p>Let&rsquo;s take a quick tour. You can skip at any time.</p>
      </>
    ),
  },
  {
    title: "Play Online",
    selector: "[data-tour='nav-play']",
    position: "bottom",
    content: (
      <p>The <strong>Play</strong> tab is your main lobby. Create a game or join an existing one.</p>
    ),
  },
  {
    title: "Time Controls",
    selector: "[data-tour='time-grid']",
    position: "right",
    content: (
      <>
        <p>Pick a time control from the grid. For example, <strong>5+3</strong> means 5 minutes per side with 3 seconds added after each move.</p>
        <p>Click <strong>Custom</strong> to set your own time and increment.</p>
      </>
    ),
  },
  {
    title: "Open Games",
    selector: "[data-tour='rooms-table']",
    position: "left",
    content: (
      <>
        <p>This table shows all open games waiting for an opponent. Click any row to join.</p>
        <p>If you get disconnected, you can rejoin&mdash;your game state is preserved.</p>
      </>
    ),
  },
  {
    title: "Private Games",
    selector: "[data-tour='private-game']",
    position: "top",
    content: (
      <p>Want to play a friend? Create a <strong>private game</strong> and share the invite link. It won&rsquo;t appear in the lobby.</p>
    ),
  },
  {
    title: "Play vs Computer",
    selector: "[data-tour='nav-computer']",
    position: "bottom",
    content: (
      <>
        <p>Play against <strong>Stockfish</strong> with 12 difficulty levels. No time limit&mdash;take as long as you need.</p>
        <p>You can freely undo moves, and finished games are saved for analysis.</p>
      </>
    ),
  },
  {
    title: "Puzzle Trainer",
    selector: "[data-tour='nav-puzzles']",
    position: "bottom",
    content: (
      <p>Solve tactical puzzles matched to your skill level. Use hints if you get stuck, or reveal the solution.</p>
    ),
  },
  {
    title: "Game History",
    selector: "[data-tour='nav-games']",
    position: "bottom",
    content: (
      <p>All your games&mdash;online and vs computer&mdash;are saved here. Click any game to analyze it with <strong>engine evaluation</strong>, score graph, and move quality annotations.</p>
    ),
  },
  {
    title: "Board Customization",
    selector: "[data-tour='settings-btn']",
    position: "bottom",
    content: (
      <p>Choose from <strong>19 board themes</strong> and <strong>39 piece sets</strong> including a blindfold mode. Your choices are saved.</p>
    ),
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;

function getElementRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

type TooltipPos = { top?: number; bottom?: number; left?: number; right?: number; transformX: string };

function computeTooltipPos(
  rect: Rect,
  position: "bottom" | "top" | "left" | "right",
  tooltipWidth: number
): TooltipPos {
  const gap = 12;
  const centerX = rect.left + rect.width / 2 - tooltipWidth / 2;
  const clampedX = Math.max(12, Math.min(centerX, window.innerWidth - tooltipWidth - 12));

  switch (position) {
    case "bottom":
      return { top: rect.top + rect.height + gap, left: clampedX, transformX: "0" };
    case "top":
      return { bottom: window.innerHeight - rect.top + gap, left: clampedX, transformX: "0" };
    case "right":
      return { top: rect.top, left: rect.left + rect.width + gap, transformX: "0" };
    case "left":
      return { top: rect.top, right: window.innerWidth - rect.left + gap, transformX: "0" };
  }
}

export default function Introduction({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const measure = useCallback(() => {
    const s = STEPS[step];
    if (s?.selector) {
      setTargetRect(getElementRect(s.selector));
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  if (!current) {
    onComplete();
    return null;
  }

  const hasTarget = !!targetRect;

  const tooltipWidth = 340;
  let tooltipStyle: React.CSSProperties;

  if (hasTarget && current.position) {
    const pos = computeTooltipPos(targetRect, current.position, tooltipWidth);
    tooltipStyle = {
      position: "fixed",
      width: tooltipWidth,
      top: pos.top,
      bottom: pos.bottom,
      left: pos.left,
      right: pos.right,
    };
  } else {
    tooltipStyle = {
      position: "fixed",
      width: tooltipWidth,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <div className={styles["overlay"]}>
      {hasTarget && (
        <svg className={styles["spotlightSvg"]} width="100%" height="100%">
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="6"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#tour-mask)"
          />
        </svg>
      )}

      {hasTarget && (
        <div
          className={styles["highlight"]}
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      <div ref={tooltipRef} className={styles["tooltip"]} style={tooltipStyle}>
        <div className={styles["tooltipHeader"]}>
          <span className={styles["tooltipTitle"]}>{current.title}</span>
          <span className={styles["stepCount"]}>
            {step + 1}/{STEPS.length}
          </span>
        </div>
        <div className={styles["tooltipBody"]}>{current.content}</div>

        <div className={styles["dots"]}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`${styles["dot"]} ${i === step ? styles["dotActive"] : ""} ${i < step ? styles["dotDone"] : ""}`}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className={styles["actions"]}>
          <button className={styles["skipBtn"]} onClick={onComplete}>
            {isLast ? "Close" : "Skip"}
          </button>
          {step > 0 && (
            <button className={styles["backBtn"]} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {!isLast ? (
            <button className={styles["nextBtn"]} onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button className={styles["nextBtn"]} onClick={onComplete}>
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
