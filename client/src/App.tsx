import { useState, useCallback, useEffect, lazy, Suspense } from "react";
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
  loadLocal,
  saveLocal,
  parsePartialFromServer,
} from "./hooks/useUserPreferences";
import { useI18n } from "./i18n/I18nProvider";
import type { AppLocale } from "./i18n/locale";
import { getEnv } from "./types";

const StatsGraphs = lazy(() => import("./components/StatsGraphs"));

const USER_ID_KEY = "chess-player-name";
const DISPLAY_NAME_KEY = "chess-display-name";
const ACTIVE_GAME_KEY = "chess-active-room";

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
  const [activeGameRoomId, setActiveGameRoomId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_GAME_KEY);
  });

  const boardPrefs = useBoardPreferences();

  useEffect(() => {
    if (showIntro && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [showIntro, location.pathname, navigate]);

  const handleActiveGameChange = useCallback((roomId: string | null) => {
    setActiveGameRoomId(roomId);
    if (roomId) {
      localStorage.setItem(ACTIVE_GAME_KEY, roomId);
    } else {
      localStorage.removeItem(ACTIVE_GAME_KEY);
    }
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

export default function App() {
  const { setLocale } = useI18n();
  const location = useLocation();
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem(USER_ID_KEY) || "";
  });
  const [displayName, setDisplayName] = useState<string>(() => {
    return localStorage.getItem(DISPLAY_NAME_KEY) || localStorage.getItem(USER_ID_KEY) || "";
  });
  const [samlChecked, setSamlChecked] = useState(() => {
    return getEnv().FEATURE_SAML_AUTH !== "true";
  });

  const samlEnabled = getEnv().FEATURE_SAML_AUTH === "true";

  useEffect(() => {
    if (!samlEnabled) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          window.location.href = "/auth/login";
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
            localStorage.setItem(USER_ID_KEY, uid);
            localStorage.setItem(DISPLAY_NAME_KEY, dn);

            const prefsRec = rec["preferences"];
            if (prefsRec && typeof prefsRec === "object") {
              const partial = parsePartialFromServer(prefsRec);
              if (Object.keys(partial).length > 0) {
                const local = loadLocal();
                const merged = { ...local, ...partial };
                saveLocal(merged);
              }
            }

            setSamlChecked(true);
          }
        } else {
          window.location.href = "/auth/login";
        }
      } catch {
        if (!cancelled) setSamlChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [samlEnabled]);

  const handleSetName = (name: string, chosenLocale: AppLocale) => {
    const trimmed = name.trim();
    const merged = { ...loadLocal(), locale: chosenLocale };
    saveLocal(merged);
    setLocale(chosenLocale);
    setUserId(trimmed);
    setDisplayName(trimmed);
    localStorage.setItem(USER_ID_KEY, trimmed);
    localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
  };

  const handleChangeName = useCallback(() => {
    setUserId("");
    setDisplayName("");
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(DISPLAY_NAME_KEY);
  }, []);

  if (location.pathname === "/stats/graphs" && getEnv().FEATURE_STATS !== "false") {
    return (
      <Suspense fallback={null}>
        <StatsGraphs />
      </Suspense>
    );
  }

  if (!samlChecked) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#ccc" }}>
        Authenticating…
      </div>
    );
  }

  if (!userId) {
    if (samlEnabled) {
      window.location.href = "/auth/login";
      return null;
    }
    return (
      <>
        <NamePrompt onSubmit={handleSetName} />
        <Footer />
      </>
    );
  }

  return (
    <UserPrefsProvider userId={userId}>
      <UserPrefsLocaleSync />
      <AppInner userId={userId} displayName={displayName} onChangeName={handleChangeName} />
    </UserPrefsProvider>
  );
}
