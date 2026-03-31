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

export function useUserPreferences(
  userId: string,
  initialPrefs?: Partial<UserPreferences>
): UserPrefsContextValue {
  const [prefs, setPrefs] = useState<UserPreferences>(() => ({
    ...DEFAULTS,
    ...(initialPrefs ?? {}),
  }));
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
          if (!cancelled) setPrefs((prev) => ({ ...prev, ...partial }));
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
  initialPrefs,
  children,
}: {
  userId: string;
  initialPrefs?: Partial<UserPreferences>;
  children: ReactNode;
}): React.ReactElement {
  const value = useUserPreferences(userId, initialPrefs);
  return React.createElement(UserPrefsContext.Provider, { value }, children);
}
