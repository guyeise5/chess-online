export type AppLocale = "en" | "he";

export const APP_LOCALES: readonly AppLocale[] = ["en", "he"] as const;

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "he";
}

/** Reads persisted locale from local user prefs JSON (before login, may be empty). */
export function readInitialLocale(): AppLocale {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return "en";
  }
  try {
    const raw = window.localStorage.getItem("chess-user-prefs");
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        isAppLocale((parsed as Record<string, unknown>)["locale"])
      ) {
        return (parsed as { locale: AppLocale }).locale;
      }
    }
  } catch {
    /* ignore */
  }
  return "en";
}
