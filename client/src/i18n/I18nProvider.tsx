import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readInitialLocale, type AppLocale } from "./locale";
import { en } from "./en";
import { he } from "./he";

const DICTS: Record<AppLocale, Record<string, string>> = { en, he };

export function applyTemplate(
  template: string,
  vars?: Record<string, string>
): string {
  if (!vars) return template;
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(v);
  }
  return s;
}

export interface I18nContextValue {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === "undefined") return "en";
    return readInitialLocale();
  });

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale === "he" ? "he" : "en";
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const dict = DICTS[locale];
      const fromLocale = dict && key in dict ? dict[key] : undefined;
      const fromEn = key in en ? en[key] : undefined;
      const raw = fromLocale ?? fromEn ?? key;
      return applyTemplate(raw, vars);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      dir: locale === "he" ? "rtl" : "ltr",
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
