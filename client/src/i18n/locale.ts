export type AppLocale = "en" | "he" | "ru" | "fr" | "es";

export const APP_LOCALES: readonly AppLocale[] = ["en", "he", "ru", "fr", "es"] as const;

const LOCALE_SET: ReadonlySet<string> = new Set(APP_LOCALES);

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && LOCALE_SET.has(value);
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
