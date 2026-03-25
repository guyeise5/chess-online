import { useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import { UserPrefsProvider, useUserPrefs } from "./hooks/useUserPreferences";
import { getEnv } from "./types";

const PLAYER_NAME_KEY = "chess-player-name";
const ACTIVE_GAME_KEY = "chess-active-room";

function ActiveGameGuard({ activeGameRoomId, children }: { activeGameRoomId: string | null; children: React.ReactNode }) {
  const location = useLocation();
  if (activeGameRoomId && !location.pathname.startsWith(`/game/${activeGameRoomId}`)) {
    return <Navigate to={`/game/${activeGameRoomId}`} replace />;
  }
  return <>{children}</>;
}

function AppInner({ playerName, onChangeName }: { playerName: string; onChangeName: () => void }) {
  const { prefs, update } = useUserPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    return getEnv().FEATURE_INTRODUCTION !== "false" && !prefs.introSeen;
  });
  const [activeGameRoomId, setActiveGameRoomId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_GAME_KEY);
  });

  const boardPrefs = useBoardPreferences();

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

  return (
    <>
      <ActiveGameGuard activeGameRoomId={activeGameRoomId}>
        <Routes>
          <Route
            path="/"
            element={
              <Lobby playerName={playerName} onChangeName={onChangeName} onOpenSettings={openSettings} boardPrefs={boardPrefs} />
            }
          />
          <Route
            path="/computer"
            element={
              <ComputerSetup
                playerName={playerName}
                onChangeName={onChangeName}
                onOpenSettings={openSettings}
                boardPrefs={boardPrefs}
              />
            }
          />
          <Route
            path="/play/computer"
            element={<ComputerGame playerName={playerName} boardPrefs={boardPrefs} onOpenSettings={openSettings} />}
          />
          <Route
            path="/game/:roomId"
            element={
              <GameRoom
                playerName={playerName}
                boardPrefs={boardPrefs}
                onOpenSettings={openSettings}
                onActiveGameChange={handleActiveGameChange}
              />
            }
          />
          <Route path="/analysis/:gameId" element={<AnalysisBoard playerName={playerName} boardPrefs={boardPrefs} onOpenSettings={openSettings} />} />
          <Route
            path="/games"
            element={
              <GameHistory
                playerName={playerName}
                onChangeName={onChangeName}
                onOpenSettings={openSettings}
              />
            }
          />
          <Route
            path="/invite/:roomId"
            element={
              <PrivateInvite
                playerName={playerName}
                onChangeName={onChangeName}
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
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  });

  const handleSetName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const handleChangeName = useCallback(() => {
    setPlayerName("");
    localStorage.removeItem(PLAYER_NAME_KEY);
  }, []);

  if (!playerName) {
    return (
      <>
        <NamePrompt onSubmit={handleSetName} />
        <Footer />
      </>
    );
  }

  return (
    <UserPrefsProvider playerName={playerName}>
      <AppInner playerName={playerName} onChangeName={handleChangeName} />
    </UserPrefsProvider>
  );
}
