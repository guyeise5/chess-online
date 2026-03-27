import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { getEnv } from "../types";
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

function useIntroSteps(t: (key: string) => string): Step[] {
  return useMemo(() => {
    const showOnlineCount = getEnv().FEATURE_ONLINE_PLAYER_COUNT !== "false";

    const onlineCountStep: Step = {
      title: t("intro.onlineCount.title"),
      selector: "[data-tour='online-count']",
      position: "left",
      content: <p>{t("intro.onlineCount.body")}</p>,
    };

    return [
      {
        title: t("intro.welcome.title"),
        content: (
          <>
            <p>{t("intro.welcome.p1")}</p>
            <p>{t("intro.welcome.p2")}</p>
          </>
        ),
      },
      {
        title: t("intro.playOnline.title"),
        selector: "[data-tour='nav-play']",
        position: "bottom",
        content: (
          <p>
            {t("intro.playOnline.p1a")}
            <strong>{t("nav.play")}</strong>
            {t("intro.playOnline.p1b")}
          </p>
        ),
      },
      ...(showOnlineCount ? [onlineCountStep] : []),
      {
        title: t("intro.time.title"),
        selector: "[data-tour='time-grid']",
        position: "right",
        content: (
          <>
            <p>
              {t("intro.time.p1a")}
              <strong>{t("intro.time.p1example")}</strong>
              {t("intro.time.p1b")}
            </p>
            <p>
              {t("intro.time.p2a")}
              <strong>{t("lobby.custom")}</strong>
              {t("intro.time.p2b")}
            </p>
          </>
        ),
      },
      {
        title: t("intro.rooms.title"),
        selector: "[data-tour='rooms-table']",
        position: "left",
        content: (
          <>
            <p>{t("intro.rooms.p1")}</p>
            <p>{t("intro.rooms.p2")}</p>
          </>
        ),
      },
      {
        title: t("intro.private.title"),
        selector: "[data-tour='private-game']",
        position: "top",
        content: (
          <p>
            {t("intro.private.p1a")}
            <strong>{t("intro.private.term")}</strong>
            {t("intro.private.p1b")}
          </p>
        ),
      },
      {
        title: t("intro.computer.title"),
        selector: "[data-tour='nav-computer']",
        position: "bottom",
        content: (
          <>
            <p>
              {t("intro.computer.p1a")}
              <strong>{t("engine.stockfish")}</strong>
              {t("intro.computer.p1b")}
            </p>
            <p>{t("intro.computer.p2")}</p>
          </>
        ),
      },
      {
        title: t("intro.puzzles.title"),
        selector: "[data-tour='nav-puzzles']",
        position: "bottom",
        content: <p>{t("intro.puzzles.body")}</p>,
      },
      {
        title: t("intro.history.title"),
        selector: "[data-tour='nav-games']",
        position: "bottom",
        content: (
          <p>
            {t("intro.history.p1a")}
            <strong>{t("intro.history.engine")}</strong>
            {t("intro.history.p1b")}
          </p>
        ),
      },
      {
        title: t("intro.board.title"),
        selector: "[data-tour='settings-btn']",
        position: "bottom",
        content: (
          <p>
            {t("intro.board.p1a")}
            <strong>{t("intro.board.themesCount")}</strong>
            {t("intro.board.p1mid")}
            <strong>{t("intro.board.piecesCount")}</strong>
            {t("intro.board.p1b")}
          </p>
        ),
      },
    ];
  }, [t]);
}

export default function Introduction({ onComplete }: Props) {
  const { t } = useI18n();
  const steps = useIntroSteps(t);
  const maskUid = useId().replace(/:/g, "");
  const maskUrl = `url(#${maskUid})`;

  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const measure = useCallback(() => {
    const s = steps[step];
    if (s?.selector) {
      setTargetRect(getElementRect(s.selector));
    } else {
      setTargetRect(null);
    }
  }, [step, steps]);

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
            <mask id={maskUid}>
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
            mask={maskUrl}
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
            {step + 1}/{steps.length}
          </span>
        </div>
        <div className={styles["tooltipBody"]}>{current.content}</div>

        <div className={styles["dots"]}>
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles["dot"]} ${i === step ? styles["dotActive"] : ""} ${i < step ? styles["dotDone"] : ""}`}
              onClick={() => setStep(i)}
              aria-label={t("intro.stepAria", { n: String(i + 1) })}
            />
          ))}
        </div>

        <div className={styles["actions"]}>
          <button type="button" className={styles["skipBtn"]} onClick={onComplete}>
            {isLast ? t("intro.close") : t("intro.skip")}
          </button>
          {step > 0 && (
            <button type="button" className={styles["backBtn"]} onClick={() => setStep(step - 1)}>
              {t("intro.back")}
            </button>
          )}
          {!isLast ? (
            <button type="button" className={styles["nextBtn"]} onClick={() => setStep(step + 1)}>
              {t("intro.next")}
            </button>
          ) : (
            <button type="button" className={styles["nextBtn"]} onClick={onComplete}>
              {t("intro.getStarted")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
