import type { AppLocale } from "./locale";

/** Localizes known English system chat lines from the server for Hebrew UI. */
export function translateSystemChat(
  text: string,
  locale: AppLocale,
  t: (key: string, vars?: Record<string, string>) => string
): string {
  if (locale !== "he") return text;

  if (text === "Game started — good luck!") {
    return t("chat.system.gameStarted");
  }
  if (text === "Draw — mutual agreement") {
    return t("chat.system.drawMutual");
  }

  const gave = /^(.+) gave 15 seconds$/.exec(text);
  if (gave && gave[1]) {
    return t("chat.system.gaveTime", { name: gave[1] });
  }

  const dash = /^(White wins|Black wins|Draw) — (.+)$/.exec(text);
  if (dash && dash[1] && dash[2]) {
    const labelKey =
      dash[1] === "White wins"
        ? "chat.result.white"
        : dash[1] === "Black wins"
          ? "chat.result.black"
          : "chat.result.draw";
    const label = t(labelKey);
    const detailRaw = dash[2];
    const detailKey = REASON_DETAIL[detailRaw];
    const detail = detailKey ? t(detailKey) : detailRaw;
    return `${label} — ${detail}`;
  }

  return text;
}

const REASON_DETAIL: Record<string, string> = {
  timeout: "reason.timeout",
  resignation: "reason.resignation",
  "mutual agreement": "reason.mutual",
  checkmate: "reason.checkmate",
  stalemate: "reason.stalemate",
  "threefold repetition": "reason.threefold",
  "insufficient material": "reason.insufficient",
  "50-move rule": "reason.fifty",
  "opponent left": "reason.opponentLeft",
  "opponent left — draw claimed": "reason.opponentLeftDraw",
};
