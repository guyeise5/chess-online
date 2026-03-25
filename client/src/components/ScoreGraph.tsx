import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import styles from "./ScoreGraph.module.css";

interface Props {
  evals: { score: number }[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

const CLAMP = 1000;
const FILL_WHITE = "rgba(232, 230, 225, 0.7)";
const FILL_BLACK = "rgba(64, 61, 57, 0.7)";
const LINE_EVAL = "#9a9690";
const LINE_CENTER = "#5c5c5c";
const ACCENT = "#769656";

export function clampEvalScore(score: number): number {
  return Math.max(-CLAMP, Math.min(CLAMP, score));
}

export function evalY(score: number, height: number): number {
  const c = clampEvalScore(score);
  return height / 2 - (c / CLAMP) * (height / 2);
}

export function xForEvalIndex(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  return (index / (count - 1)) * width;
}

export function indexFromCanvasX(
  x: number,
  width: number,
  count: number
): number {
  if (count <= 0) return 0;
  if (count === 1) return 0;
  const raw = (x / width) * (count - 1);
  return Math.round(Math.min(count - 1, Math.max(0, raw)));
}

function zeroCrossX(
  x0: number,
  x1: number,
  s0: number,
  s1: number
): number {
  if (s1 === s0) return x0;
  return x0 - (s0 * (x1 - x0)) / (s1 - s0);
}

function drawSegmentFill(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s0: number,
  s1: number,
  midY: number
): void {
  const bothNonNeg = s0 >= 0 && s1 >= 0;
  const bothNonPos = s0 <= 0 && s1 <= 0;

  if (bothNonNeg) {
    ctx.fillStyle = FILL_WHITE;
    ctx.beginPath();
    ctx.moveTo(x0, midY);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, midY);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (bothNonPos) {
    ctx.fillStyle = FILL_BLACK;
    ctx.beginPath();
    ctx.moveTo(x0, midY);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, midY);
    ctx.closePath();
    ctx.fill();
    return;
  }

  const xc = zeroCrossX(x0, x1, s0, s1);

  if (s0 > 0 && s1 < 0) {
    ctx.fillStyle = FILL_WHITE;
    ctx.beginPath();
    ctx.moveTo(x0, midY);
    ctx.lineTo(x0, y0);
    ctx.lineTo(xc, midY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = FILL_BLACK;
    ctx.beginPath();
    ctx.moveTo(xc, midY);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, midY);
    ctx.closePath();
    ctx.fill();
    return;
  }

  ctx.fillStyle = FILL_BLACK;
  ctx.beginPath();
  ctx.moveTo(x0, midY);
  ctx.lineTo(x0, y0);
  ctx.lineTo(xc, midY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = FILL_WHITE;
  ctx.beginPath();
  ctx.moveTo(xc, midY);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1, midY);
  ctx.closePath();
  ctx.fill();
}

export default function ScoreGraph({
  evals,
  currentIndex,
  onSelectIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(0, Math.floor(cr.width));
      const h = Math.max(0, Math.floor(cr.height));
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const w = size.width;
    const h = size.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    const n = evals.length;
    if (n > 0) {
      const clamped = evals.map((e) => clampEvalScore(e.score));
      const xs = clamped.map((_, i) => xForEvalIndex(i, n, w));
      const ys = clamped.map((s) => evalY(s, h));

      for (let i = 0; i < n - 1; i++) {
        const x0 = xs[i];
        const y0 = ys[i];
        const x1 = xs[i + 1];
        const y1 = ys[i + 1];
        const c0 = clamped[i];
        const c1 = clamped[i + 1];
        if (
          x0 === undefined ||
          y0 === undefined ||
          x1 === undefined ||
          y1 === undefined ||
          c0 === undefined ||
          c1 === undefined
        ) {
          continue;
        }
        drawSegmentFill(ctx, x0, y0, x1, y1, c0, c1, midY);
      }

      ctx.strokeStyle = LINE_EVAL;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      const xStart = xs[0];
      const yStart = ys[0];
      if (xStart !== undefined && yStart !== undefined) {
        ctx.moveTo(xStart, yStart);
        for (let i = 1; i < n; i++) {
          const xi = xs[i];
          const yi = ys[i];
          if (xi === undefined || yi === undefined) continue;
          ctx.lineTo(xi, yi);
        }
      }
      ctx.stroke();

      const hi = Math.min(n - 1, Math.max(0, currentIndex));
      const xi = xForEvalIndex(hi, n, w);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xi, 0);
      ctx.lineTo(xi, h);
      ctx.stroke();
    }

    ctx.strokeStyle = LINE_CENTER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
  }, [evals, currentIndex, size]);

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLCanvasElement>) => {
      if (evals.length === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      if (w <= 0) return;
      onSelectIndex(indexFromCanvasX(x, w, evals.length));
    },
    [evals.length, onSelectIndex]
  );

  return (
    <div ref={containerRef} className={styles['container']}>
      <canvas
        ref={canvasRef}
        className={styles['canvas']}
        onClick={handleClick}
      />
    </div>
  );
}
