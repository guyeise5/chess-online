import type { TimeFormat } from "../types";

/** i18n key from server room time format enum. */
export function timeFormatToKey(tf: TimeFormat): string {
  return `time.${tf}`;
}

/** i18n key for Lichess-style time category from minutes + increment. */
export function timeCategoryKey(minutes: number, increment: number): string {
  const total = minutes * 60 + increment * 40;
  if (total < 29) return "time.ultrabullet";
  if (total < 180) return "time.bullet";
  if (total < 480) return "time.blitz";
  if (total < 1500) return "time.rapid";
  return "time.classical";
}
