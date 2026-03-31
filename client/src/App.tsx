import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Lobby from "./components/Lobby";
import ComputerSetup from "./components/ComputerSetup";
import ComputerGame from "./components/ComputerGame";
import GameRoom from "./components/GameRoom";
import PuzzleTrainer from "./components/PuzzleTrainer";
import AnalysisBoard from "./components/AnalysisBoard";
import GameHistory from "./components/GameHistory";
import PrivateInvite from "./components/PrivateInvite";
import BoardSettings from "./components/BoardSettings";
import Introduction from "./components/Introduction";
import NamePrompt from "./components/NamePrompt";
import Footer from "./components/Footer";
import useBoardPreferences from "./hooks/useBoardPreferences";
import {
  UserPrefsProvider,
  useUserPrefs,
  parsePartialFromServer,
  type UserPreferences,
} from "./hooks/useUserPreferences";
import { useI18n } from "./i18n/I18nProvider";
import { getEnv } from "./types";

const StatsGraphs = lazy(() => import("./components/StatsGraphs"));

function ActiveGameGuard({ activeGameRoomId, children }: { activeGameRoomId: string | null; children: React.ReactNode }) {
  const location = useLocation();
  if (activeGameRoomId && !location.pathname.startsWith(`/game/${activeGameRoomId}`)) {
    return <Navigate to={`/game/${activeGameRoomId}`} replace />;
  }
  return <>{children}</>;
}

function UserPrefsLocaleSync() {
  const { prefs, loaded } = useUserPrefs();
  const { setLocale, locale } = useI18n();

  useEffect(() => {
    if (!loaded) return;
    if (prefs.locale !== locale) {
      setLocale(prefs.locale);
    }
  }, [loaded, prefs.locale, locale, setLocale]);

  return null;
}

function AppInner({ userId, displayName, onChangeName }: { userId: string; displayName: string; onChangeName: () => void }) {
  const { prefs, update, loaded } = useUserPrefs();
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    return getEnv().FEATURE_INTRODUCTION !== "false" && !prefs.introSeen;
  });
  const [activeGameRoomId, setActiveGameRoomId] = useState<string | null>(null);

  const boardPrefs = useBoardPreferences();

  useEffect(() => {
    if (loaded && prefs.introSeen) {
      setShowIntro(false);
    }
  }, [loaded, prefs.introSeen]);

  useEffect(() => {
    if (showIntro && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [showIntro, location.pathname, navigate]);

  const handleActiveGameChange = useCallback((roomId: string | null) => {
    setActiveGameRoomId(roomId);
  }, []);

  const handleIntroDone = useCallback(() => {
    setShowIntro(false);
    update({ introSeen: true });
  }, [update]);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const samlEnabled = getEnv().FEATURE_SAML_AUTH === "true";

  if (!loaded) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#ccc" }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <ActiveGameGuard activeGameRoomId={activeGameRoomId}>
        <Routes>
          <Route
            path="/"
            element={
              <Lobby
                userId={userId}
                displayName={displayName}
                {...(!samlEnabled ? { onChangeName } : {})}
                onOpenSettings={openSettings}
                boardPrefs={boardPrefs}
              />
            }
          />
          <Route
            path="/computer"
            element={
              <ComputerSetup
                userId={userId}
                displayName={displayName}
                {...(!samlEnabled ? { onChangeName } : {})}
                onOpenSettings={openSettings}
                boardPrefs={boardPrefs}
              />
            }
          />
          <Route
            path="/play/computer"
            element={<ComputerGame userId={userId} displayName={displayName} boardPrefs={boardPrefs} onOpenSettings={openSettings} />}
          />
          <Route
            path="/game/:roomId"
            element={
              <GameRoom
                userId={userId}
                displayName={displayName}
                boardPrefs={boardPrefs}
                onOpenSettings={openSettings}
                onActiveGameChange={handleActiveGameChange}
              />
            }
          />
          <Route path="/analysis/:gameId" element={<AnalysisBoard userId={userId} displayName={displayName} boardPrefs={boardPrefs} onOpenSettings={openSettings} />} />
          <Route path="/analyzePuzzle/:gameId" element={<AnalysisBoard userId={userId} displayName={displayName} boardPrefs={boardPrefs} onOpenSettings={openSettings} />} />
          <Route
            path="/games"
            element={
              <GameHistory
                userId={userId}
                displayName={displayName}
                {...(!samlEnabled ? { onChangeName } : {})}
                onOpenSettings={openSettings}
              />
            }
          />
          <Route
            path="/invite/:roomId"
            element={
              <PrivateInvite
                userId={userId}
                displayName={displayName}
                {...(!samlEnabled ? { onChangeName } : {})}
                onOpenSettings={openSettings}
                boardPrefs={boardPrefs}
              />
            }
          />
          <Route path="/puzzles" element={<PuzzleTrainer boardPrefs={boardPrefs} onOpenSettings={openSettings} />} />
          <Route path="/puzzles/:puzzleId" element={<PuzzleTrainer boardPrefs={boardPrefs} onOpenSettings={openSettings} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ActiveGameGuard>
      {settingsOpen && (
        <BoardSettings boardPrefs={boardPrefs} onClose={closeSettings} />
      )}
      {showIntro && <Introduction onComplete={handleIntroDone} />}
      <Footer />
    </>
  );
}

const USER_STORAGE_KEY = "chess-user";

function readStoredUser(): { userId: string; displayName: string } {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return { userId: "", displayName: "" };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const rec = parsed as Record<string, unknown>;
      const uid = typeof rec["userId"] === "string" ? rec["userId"] : "";
      const dn = typeof rec["displayName"] === "string" ? rec["displayName"] : uid;
      return { userId: uid, displayName: dn };
    }
  } catch { /* corrupt or unavailable */ }
  return { userId: "", displayName: "" };
}

function persistUser(userId: string, displayName: string): void {
  try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ userId, displayName })); } catch { /* ignore */ }
}

function clearStoredUser(): void {
  try { localStorage.removeItem(USER_STORAGE_KEY); } catch { /* ignore */ }
}

export default function App() {
  const location = useLocation();
  const samlEnabled = getEnv().FEATURE_SAML_AUTH === "true";

  const [userId, setUserId] = useState(() => {
    if (samlEnabled) return "";
    return readStoredUser().userId;
  });
  const [displayName, setDisplayName] = useState(() => {
    if (samlEnabled) return "";
    return readStoredUser().displayName;
  });
  const [samlChecked, setSamlChecked] = useState(() => !samlEnabled);
  const initialPrefsRef = useRef<Partial<UserPreferences>>({});

  useEffect(() => {
    if (!samlEnabled) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setSamlChecked(true);
          return;
        }
        const body: unknown = await res.json();
        if (body && typeof body === "object" && "userId" in body) {
          const rec = body as Record<string, unknown>;
          const uid = typeof rec["userId"] === "string" ? rec["userId"] : "";
          const dn = typeof rec["displayName"] === "string" ? rec["displayName"] : uid;
          if (uid && !cancelled) {
            setUserId(uid);
            setDisplayName(dn);

            const prefsRec = rec["preferences"];
            if (prefsRec && typeof prefsRec === "object") {
              const partial = parsePartialFromServer(prefsRec);
              if (Object.keys(partial).length > 0) {
                initialPrefsRef.current = partial;
              }
            }
          }
        }
        if (!cancelled) setSamlChecked(true);
      } catch {
        if (!cancelled) setSamlChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [samlEnabled]);

  const handleSetName = (name: string) => {
    const trimmed = name.trim();
    setUserId(trimmed);
    setDisplayName(trimmed);
    if (!samlEnabled) persistUser(trimmed, trimmed);
  };

  const handleChangeName = useCallback(() => {
    setUserId("");
    setDisplayName("");
    if (!samlEnabled) clearStoredUser();
  }, [samlEnabled]);

  if (location.pathname === "/stats/graphs" && getEnv().FEATURE_STATS !== "false") {
    return (
      <Suspense fallback={null}>
        <StatsGraphs />
      </Suspense>
    );
  }

  if (samlEnabled) {
    if (!samlChecked) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#ccc" }}>
          Loading…
        </div>
      );
    }
    if (!userId) {
      window.location.href = "/auth/login";
      return null;
    }
  }

  if (!samlEnabled && !userId) {
    return (
      <>
        <NamePrompt onSubmit={handleSetName} />
        <Footer />
      </>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <UserPrefsProvider userId={userId} initialPrefs={initialPrefsRef.current}>
      <UserPrefsLocaleSync />
      <AppInner userId={userId} displayName={displayName} onChangeName={handleChangeName} />
    </UserPrefsProvider>
  );
}
