import { getEnv } from "../types";

export type SoundType = "move" | "capture" | "gameStart" | "gameEnd" | "lowTime";

const SOUND_FILES: Record<SoundType, string> = {
  move: "/sounds/Move.mp3",
  capture: "/sounds/Capture.mp3",
  gameStart: "/sounds/GenericNotify.mp3",
  gameEnd: "/sounds/GenericNotify.mp3",
  lowTime: "/sounds/LowTime.mp3",
};

let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let preloaded = false;

function getContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

async function loadBuffer(
  ctx: AudioContext,
  src: string
): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(src);
  if (cached) return cached;
  try {
    const res = await fetch(src);
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    bufferCache.set(src, buf);
    return buf;
  } catch {
    return null;
  }
}

function preloadAll(): void {
  if (preloaded) return;
  preloaded = true;
  const ctx = getContext();
  if (!ctx) return;
  const srcs = new Set(Object.values(SOUND_FILES));
  for (const src of srcs) {
    loadBuffer(ctx, src);
  }
}

if (typeof document !== "undefined") {
  const unlock = () => {
    const ctx = getContext();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    preloadAll();
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
    document.removeEventListener("keydown", unlock);
  };
  document.addEventListener("click", unlock);
  document.addEventListener("touchstart", unlock);
  document.addEventListener("keydown", unlock);
}

function playBuffer(ctx: AudioContext, buffer: AudioBuffer): void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

function doPlay(ctx: AudioContext, src: string): void {
  const buffer = bufferCache.get(src);
  if (buffer) {
    playBuffer(ctx, buffer);
  } else {
    loadBuffer(ctx, src).then((buf) => {
      if (buf) playBuffer(ctx, buf);
    });
  }
}

export function playSound(type: SoundType): void {
  if (getEnv().FEATURE_MOVE_SOUND === "false") return;
  const src = SOUND_FILES[type];
  if (!src) return;
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().then(() => doPlay(ctx, src)).catch(() => {});
  } else {
    doPlay(ctx, src);
  }
}

export function getSoundTypeForSan(san: string): SoundType {
  if (typeof san !== "string" || san.length === 0) return "move";
  if (san.includes("x")) return "capture";
  return "move";
}

export function playMoveSound(san: string): void {
  playSound(getSoundTypeForSan(san));
}

