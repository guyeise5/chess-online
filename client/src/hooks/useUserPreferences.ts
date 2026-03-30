import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getEnv } from "../types";
import { isAppLocale, type AppLocale } from "../i18n/locale";

const LOCAL_KEY = "chess-user-prefs";

export interface UserPreferences {
  introSeen: boolean;
  locale: AppLocale;
  boardTheme: string;
  pieceSet: string;
  lobbyColor: string;
  customMinIdx: number;
  customIncIdx: number;
  computerColor: string;
  puzzleRating: number;
  puzzleCount: number;
}

export const DEFAULTS: UserPreferences = {
  introSeen: false,
  locale: "en",
  boardTheme: "brown",
  pieceSet: "cburnett",
  lobbyColor: "random",
  customMinIdx: 7,
  customIncIdx: 3,
  computerColor: "white",
  puzzleRating: 1500,
  puzzleCount: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readFiniteInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function parseStoredObject(obj: Record<string, unknown>): UserPreferences {
  const locRaw = obj["locale"];
  const locale: AppLocale = isAppLocale(locRaw) ? locRaw : DEFAULTS.locale;
  return {
    introSeen: readBoolean(obj["introSeen"], DEFAULTS.introSeen),
    locale,
    boardTheme: readString(obj["boardTheme"], DEFAULTS.boardTheme),
    pieceSet: readString(obj["pieceSet"], DEFAULTS.pieceSet),
    lobbyColor: readString(obj["lobbyColor"], DEFAULTS.lobbyColor),
    customMinIdx: readFiniteInt(obj["customMinIdx"], DEFAULTS.customMinIdx),
    customIncIdx: readFiniteInt(obj["customIncIdx"], DEFAULTS.customIncIdx),
    computerColor: readString(obj["computerColor"], DEFAULTS.computerColor),
    puzzleRating: readFiniteNumber(obj["puzzleRating"], DEFAULTS.puzzleRating),
    puzzleCount: readFiniteInt(obj["puzzleCount"], DEFAULTS.puzzleCount),
  };
}

/** Reads from localStorage, returns parsed prefs or DEFAULTS. */
export function loadLocal(): UserPreferences {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return { ...DEFAULTS };
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw === null) return { ...DEFAULTS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULTS };
    return parseStoredObject(parsed);
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveLocal(prefs: UserPreferences): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

function unwrapServerPayload(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const data = raw["data"];
  if (isRecord(data)) return data;
  return raw;
}

/** Extracts validated preference fields from API JSON (unknown shape). */
export function parsePartialFromServer(raw: unknown): Partial<UserPreferences> {
  const obj = unwrapServerPayload(raw);
  if (!obj) return {};
  const out: Partial<UserPreferences> = {};
  if ("introSeen" in obj) {
    const v = obj["introSeen"];
    if (typeof v === "boolean") out.introSeen = v;
  }
  if ("locale" in obj) {
    const v = obj["locale"];
    if (isAppLocale(v)) out.locale = v;
  }
  if ("boardTheme" in obj) {
    const v = obj["boardTheme"];
    if (typeof v === "string") out.boardTheme = v;
  }
  if ("pieceSet" in obj) {
    const v = obj["pieceSet"];
    if (typeof v === "string") out.pieceSet = v;
  }
  if ("lobbyColor" in obj) {
    const v = obj["lobbyColor"];
    if (typeof v === "string") out.lobbyColor = v;
  }
  if ("customMinIdx" in obj) {
    const v = obj["customMinIdx"];
    if (typeof v === "number" && Number.isFinite(v)) out.customMinIdx = Math.trunc(v);
    else if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) out.customMinIdx = n;
    }
  }
  if ("customIncIdx" in obj) {
    const v = obj["customIncIdx"];
    if (typeof v === "number" && Number.isFinite(v)) out.customIncIdx = Math.trunc(v);
    else if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) out.customIncIdx = n;
    }
  }
  if ("computerColor" in obj) {
    const v = obj["computerColor"];
    if (typeof v === "string") out.computerColor = v;
  }
  if ("puzzleRating" in obj) {
    const v = obj["puzzleRating"];
    if (typeof v === "number" && Number.isFinite(v)) out.puzzleRating = v;
    else if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) out.puzzleRating = n;
    }
  }
  if ("puzzleCount" in obj) {
    const v = obj["puzzleCount"];
    if (typeof v === "number" && Number.isFinite(v)) out.puzzleCount = Math.trunc(v);
    else if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) out.puzzleCount = n;
    }
  }
  return out;
}

function mergeServerWins(
  localPrefs: UserPreferences,
  serverPartial: Partial<UserPreferences>
): UserPreferences {
  return { ...localPrefs, ...serverPartial };
}

interface UserPrefsContextValue {
  prefs: UserPreferences;
  loaded: boolean;
  update: (partial: Partial<UserPreferences>) => void;
}

export const UserPrefsContext = createContext<UserPrefsContextValue>({
  prefs: DEFAULTS,
  loaded: false,
  update: () => {},
});

export function useUserPrefs(): UserPrefsContextValue {
  return useContext(UserPrefsContext);
}

export function useUserPreferences(userId: string): UserPrefsContextValue {
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadLocal());
  const [loaded, setLoaded] = useState(false);

  const prefsRemoteEnabled = getEnv().FEATURE_USER_PREFERENCES !== "false";

  useEffect(() => {
    if (!userId) {
      setLoaded(true);
      return;
    }

    if (!prefsRemoteEnabled) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/preferences/${encodeURIComponent(userId)}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const body: unknown = await res.json();
        const partial = parsePartialFromServer(body);
        if (Object.keys(partial).length > 0) {
          const merged = mergeServerWins(loadLocal(), partial);
          saveLocal(merged);
          if (!cancelled) setPrefs(merged);
        }
      } catch {
        /* offline / network */
      }
      if (!cancelled) setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, prefsRemoteEnabled]);

  const update = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...partial };
        saveLocal(next);
        if (prefsRemoteEnabled && userId) {
          fetch(`/api/preferences/${encodeURIComponent(userId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(partial),
          }).catch(() => {});
        }
        return next;
      });
    },
    [userId, prefsRemoteEnabled]
  );

  return { prefs, loaded, update };
}

/** Wrap the app (or subtree) so `useUserPrefs()` shares the same preferences state. */
export function UserPrefsProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}): React.ReactElement {
  const value = useUserPreferences(userId);
  return React.createElement(UserPrefsContext.Provider, { value }, children);
}
