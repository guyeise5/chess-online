import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/Home";
import Lobby from "./components/Lobby";
import ComputerSetup from "./components/ComputerSetup";
import ComputerGame from "./components/ComputerGame";
import GameRoom from "./components/GameRoom";
import PuzzleTrainer from "./components/PuzzleTrainer";
import AnalysisBoard from "./components/AnalysisBoard";
import NamePrompt from "./components/NamePrompt";
import Footer from "./components/Footer";

const PLAYER_NAME_KEY = "chess-player-name";

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  });

  const handleSetName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const handleChangeName = () => {
    setPlayerName("");
    localStorage.removeItem(PLAYER_NAME_KEY);
  };

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
      <Routes>
        <Route
          path="/"
          element={
            <Home playerName={playerName} onChangeName={handleChangeName} />
          }
        />
        <Route
          path="/rooms"
          element={
            <Lobby playerName={playerName} onChangeName={handleChangeName} />
          }
        />
        <Route
          path="/computer"
          element={
            <ComputerSetup
              playerName={playerName}
              onChangeName={handleChangeName}
            />
          }
        />
        <Route
          path="/play/computer"
          element={<ComputerGame playerName={playerName} />}
        />
        <Route
          path="/game/:roomId"
          element={<GameRoom playerName={playerName} />}
        />
        <Route path="/analysis/:gameId" element={<AnalysisBoard />} />
        <Route path="/puzzles" element={<PuzzleTrainer />} />
        <Route path="/puzzles/:puzzleId" element={<PuzzleTrainer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
