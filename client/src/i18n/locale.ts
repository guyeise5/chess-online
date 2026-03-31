export type AppLocale = "en" | "he" | "ru" | "fr" | "es";

export const APP_LOCALES: readonly AppLocale[] = ["en", "he", "ru", "fr", "es"] as const;

const LOCALE_SET: ReadonlySet<string> = new Set(APP_LOCALES);

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && LOCALE_SET.has(value);
}

export function readInitialLocale(): AppLocale {
  return "en";
}
