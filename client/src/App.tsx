import { useState, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Lobby from "./components/Lobby";
import ComputerSetup from "./components/ComputerSetup";
import ComputerGame from "./components/ComputerGame";
import GameRoom from "./components/GameRoom";
import PuzzleTrainer from "./components/PuzzleTrainer";
import AnalysisBoard from "./components/AnalysisBoard";
import GameHistory from "./components/GameHistory";
import BoardSettings from "./components/BoardSettings";
import NamePrompt from "./components/NamePrompt";
import Footer from "./components/Footer";
import useBoardPreferences from "./hooks/useBoardPreferences";

const PLAYER_NAME_KEY = "chess-player-name";
const ACTIVE_GAME_KEY = "chess-active-room";

function ActiveGameGuard({ activeGameRoomId, children }: { activeGameRoomId: string | null; children: React.ReactNode }) {
  const location = useLocation();
  if (activeGameRoomId && !location.pathname.startsWith(`/game/${activeGameRoomId}`)) {
    return <Navigate to={`/game/${activeGameRoomId}`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const handleSetName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const handleChangeName = () => {
    setPlayerName("");
    localStorage.removeItem(PLAYER_NAME_KEY);
  };

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  if (!playerName) {
    return (
      <>
        <NamePrompt onSubmit={handleSetName} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <ActiveGameGuard activeGameRoomId={activeGameRoomId}>
        <Routes>
          <Route
            path="/"
            element={
              <Lobby playerName={playerName} onChangeName={handleChangeName} onOpenSettings={openSettings} boardPrefs={boardPrefs} />
            }
          />
          <Route
            path="/computer"
            element={
              <ComputerSetup
                playerName={playerName}
                onChangeName={handleChangeName}
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
                onChangeName={handleChangeName}
                onOpenSettings={openSettings}
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
      <Footer />
    </>
  );
}
