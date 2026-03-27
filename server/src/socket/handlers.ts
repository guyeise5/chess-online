import { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager";
import { ColorChoice } from "../models/Room";
import { emitOnlinePlayerCount } from "./onlinePlayerCount";

const socketPlayers = new Map<string, string>();
const socketRooms = new Map<string, Set<string>>();

function trackSocketRoom(socketId: string, roomId: string): void {
  let rooms = socketRooms.get(socketId);
  if (!rooms) {
    rooms = new Set();
    socketRooms.set(socketId, rooms);
  }
  rooms.add(roomId);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function registerSocketHandlers(io: Server, gm: GameManager): void {
  const safeCallback = (callback: unknown, res: Record<string, unknown>): void => {
    if (typeof callback === "function") callback(res);
  };

  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("rooms:list", async () => {
      await gm.broadcastRooms();
    });

    socket.on(
      "room:create",
      async (
        data: {
          playerName: string;
          timeControl: number;
          increment: number;
          colorChoice: ColorChoice;
          isPrivate?: boolean;
        },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data)) { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const isPrivate = data.isPrivate === true;
          if (isPrivate && process.env["FEATURE_PRIVATE_GAMES"] === "false") {
            safeCallback(callback, { success: false, error: "Feature disabled" });
            return;
          }
          const room = await gm.createRoom(
            data.playerName,
            data.timeControl,
            data.increment,
            data.colorChoice,
            isPrivate
          );
          socket.join(room.roomId);
          socketPlayers.set(socket.id, data.playerName);
          trackSocketRoom(socket.id, room.roomId);
          safeCallback(callback, { success: true, room: gm.serializeRoom(room) });
          await gm.broadcastRooms();
        } catch (err) {
          console.error("Error creating room:", err);
          safeCallback(callback, { success: false, error: "Failed to create room" });
        }
      }
    );

    socket.on(
      "room:join",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const room = await gm.joinRoom(data.roomId, data.playerName, socket);
          if (!room) {
            safeCallback(callback, { success: false, error: "Room not found" });
            return;
          }
          socketPlayers.set(socket.id, data.playerName);
          trackSocketRoom(socket.id, data.roomId);
          safeCallback(callback, { success: true, room: gm.serializeRoom(room) });
        } catch (err) {
          console.error("Error joining room:", err);
          safeCallback(callback, { success: false, error: "Failed to join room" });
        }
      }
    );

    socket.on(
      "room:rejoin",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const room = await gm.rejoinRoom(data.roomId, data.playerName, socket);
          if (!room) {
            safeCallback(callback, { success: false, error: "Room not found or not a participant" });
            return;
          }
          socketPlayers.set(socket.id, data.playerName);
          trackSocketRoom(socket.id, data.roomId);
          await gm.handlePlayerReconnect(data.roomId, data.playerName);
          safeCallback(callback, { success: true, room: gm.serializeRoom(room) });
        } catch (err) {
          console.error("Error rejoining room:", err);
          safeCallback(callback, { success: false, error: "Failed to rejoin room" });
        }
      }
    );

    socket.on(
      "room:leave",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false }); return; }
          const closed = await gm.closeRoom(data.roomId, data.playerName);
          socket.leave(data.roomId);
          safeCallback(callback, { success: closed });
        } catch (err) {
          console.error("Error leaving room:", err);
          safeCallback(callback, { success: false, error: "Failed to leave room" });
        }
      }
    );

    socket.on(
      "room:info",
      async (
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const room = await gm.getPrivateRoomInfo(data.roomId);
          if (!room) {
            safeCallback(callback, { success: false, error: "Room not found" });
            return;
          }
          safeCallback(callback, { success: true, room: gm.serializeRoom(room) });
        } catch (err) {
          console.error("Error fetching room info:", err);
          safeCallback(callback, { success: false, error: "Failed to fetch room info" });
        }
      }
    );

    socket.on(
      "game:move",
      async (
        data: {
          roomId: string;
          playerName: string;
          from: string;
          to: string;
          promotion?: string;
        },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const result = await gm.makeMove(
          data.roomId,
          data.playerName,
          data.from,
          data.to,
          data.promotion
        );
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:undo-request",
      (data: { roomId: string; playerName: string; moveCount: number }) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") return;
        gm.requestUndo(data.roomId, data.playerName, data.moveCount);
        socket.to(data.roomId).emit("game:undo-request", {
          playerName: data.playerName,
        });
      }
    );

    socket.on(
      "game:undo-response",
      async (data: { roomId: string; accepted: boolean }) => {
        if (!isObj(data) || typeof data.roomId !== "string") return;
        if (data.accepted) {
          await gm.undoToPlayer(data.roomId);
        } else {
          io.to(data.roomId).emit("game:undo-declined");
        }
      }
    );

    socket.on(
      "game:give-time",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const result = await gm.giveTime(data.roomId, data.playerName);
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:draw-offer",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const result = await gm.offerDraw(data.roomId, data.playerName);
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:draw-response",
      async (data: { roomId: string; playerName: string; accepted: boolean }) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") return;
        await gm.respondDraw(data.roomId, data.playerName, data.accepted);
      }
    );

    socket.on(
      "game:chat",
      async (
        data: { roomId: string; playerName: string; text: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (
          !isObj(data) ||
          typeof data.roomId !== "string" ||
          typeof data.playerName !== "string" ||
          typeof data.text !== "string"
        ) {
          safeCallback(callback, { success: false, error: "Invalid payload" });
          return;
        }
        const result = await gm.sendChatMessage(
          data.roomId,
          data.playerName,
          data.text
        );
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:resign",
      async (data: { roomId: string; playerName: string }) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") return;
        await gm.resign(data.roomId, data.playerName);
      }
    );

    socket.on(
      "game:player-left",
      async (data: { roomId: string; playerName: string }) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") return;
        await gm.handlePlayerDisconnect(data.roomId, data.playerName);
      }
    );

    socket.on(
      "game:claim-disconnect-win",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const result = await gm.claimDisconnectResult(data.roomId, data.playerName, "win");
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:claim-disconnect-draw",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string" || typeof data.playerName !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const result = await gm.claimDisconnectResult(data.roomId, data.playerName, "draw");
        safeCallback(callback, result);
      }
    );

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);
      const playerName = socketPlayers.get(socket.id);
      const rooms = socketRooms.get(socket.id);
      socketPlayers.delete(socket.id);
      socketRooms.delete(socket.id);

      if (playerName) {
        await gm.closeWaitingRoomsByOwner(playerName);

        if (rooms) {
          for (const roomId of rooms) {
            await gm.handlePlayerDisconnect(roomId, playerName);
          }
        }
      }

      setImmediate(() => {
        emitOnlinePlayerCount(io);
      });
    });

    emitOnlinePlayerCount(io);
  });
}
