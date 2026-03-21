import { useState, useEffect, useCallback, useRef } from "react";
import { socket } from "./socket";
import { RoomData } from "./types";
import Lobby from "./components/Lobby";
import GameRoom from "./components/GameRoom";
import NamePrompt from "./components/NamePrompt";

const ROOM_ID_KEY = "chess-active-room";
const PLAYER_NAME_KEY = "chess-player-name";

export default function App() {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  });
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [rejoining, setRejoining] = useState(false);
  const rejoinAttempted = useRef(false);

  const rejoin = useCallback((roomId: string, name: string) => {
    setRejoining(true);
    socket.emit(
      "room:rejoin",
      { roomId, playerName: name },
      (res: { success: boolean; room?: RoomData }) => {
        setRejoining(false);
        if (res.success && res.room) {
          setCurrentRoom(res.room);
        } else {
          localStorage.removeItem(ROOM_ID_KEY);
        }
      }
    );
  }, []);

  useEffect(() => {
    socket.on("rooms:list", (data: RoomData[]) => {
      setRooms(data);
    });

    socket.on("game:start", (room: RoomData) => {
      setCurrentRoom(room);
      localStorage.setItem(ROOM_ID_KEY, room.roomId);
    });

    socket.emit("rooms:list");

    return () => {
      socket.off("rooms:list");
      socket.off("game:start");
    };
  }, []);

  // Auto-rejoin on initial load
  useEffect(() => {
    if (rejoinAttempted.current) return;
    rejoinAttempted.current = true;

    const savedRoom = localStorage.getItem(ROOM_ID_KEY);
    const savedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (savedRoom && savedName) {
      const doRejoin = () => rejoin(savedRoom, savedName);
      if (socket.connected) {
        doRejoin();
      } else {
        socket.once("connect", doRejoin);
      }
    }
  }, [rejoin]);

  // Re-rejoin whenever socket reconnects mid-game
  useEffect(() => {
    const onReconnect = () => {
      const savedRoom = localStorage.getItem(ROOM_ID_KEY);
      const savedName = localStorage.getItem(PLAYER_NAME_KEY);
      if (savedRoom && savedName) {
        rejoin(savedRoom, savedName);
      }
    };

    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.io.off("reconnect", onReconnect);
    };
  }, [rejoin]);

  const handleSetName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const handleJoinRoom = (room: RoomData) => {
    setCurrentRoom(room);
    localStorage.setItem(ROOM_ID_KEY, room.roomId);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    localStorage.removeItem(ROOM_ID_KEY);
    socket.emit("rooms:list");
  };

  if (!playerName) {
    return <NamePrompt onSubmit={handleSetName} />;
  }

  if (rejoining) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--text-secondary)" }}>
        Reconnecting to game...
      </div>
    );
  }

  if (currentRoom) {
    return (
      <GameRoom
        room={currentRoom}
        playerName={playerName}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return (
    <Lobby
      rooms={rooms}
      playerName={playerName}
      onJoinRoom={handleJoinRoom}
      onChangeName={() => {
        setPlayerName("");
        localStorage.removeItem(PLAYER_NAME_KEY);
        localStorage.removeItem(ROOM_ID_KEY);
      }}
    />
  );
}
