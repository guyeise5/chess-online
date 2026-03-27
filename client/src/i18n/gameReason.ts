import type { AppLocale } from "./locale";

/** Maps server / client endgame reason strings to i18n keys (Hebrew). */
const REASON_TO_KEY: Record<string, string> = {
  checkmate: "reason.checkmate",
  stalemate: "reason.stalemate",
  draw: "reason.drawGeneric",
  repetition: "reason.repetitionShort",
  "insufficient material": "reason.insufficient",
  resignation: "reason.resignation",
  "mutual agreement": "reason.mutual",
  timeout: "reason.timeout",
  "opponent left": "reason.opponentLeft",
  "opponent left — draw claimed": "reason.opponentLeftDraw",
  "threefold repetition": "reason.threefold",
  "50-move rule": "reason.fifty",
};

/**
 * Returns a display string for the endgame reason. English keeps the raw token;
 * Hebrew uses dictionary keys when known.
 */
export function translateEndgameReason(
  raw: string,
  locale: AppLocale,
  t: (key: string) => string
): string {
  if (locale !== "he") return raw;
  const key = REASON_TO_KEY[raw];
  return key ? t(key) : raw;
}
