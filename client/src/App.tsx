import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Lobby from "./components/Lobby";
import GameRoom from "./components/GameRoom";
import NamePrompt from "./components/NamePrompt";

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
    return <NamePrompt onSubmit={handleSetName} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Lobby playerName={playerName} onChangeName={handleChangeName} />
        }
      />
      <Route
        path="/game/:roomId"
        element={<GameRoom playerName={playerName} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
