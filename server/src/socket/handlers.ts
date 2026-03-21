import { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager";
import { ColorChoice } from "../models/Room";

const socketPlayers = new Map<string, string>();

export function registerSocketHandlers(io: Server, gm: GameManager): void {
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
        },
        callback: (res: any) => void
      ) => {
        try {
          const room = await gm.createRoom(
            data.playerName,
            data.timeControl,
            data.increment,
            data.colorChoice
          );
          socket.join(room.roomId);
          socketPlayers.set(socket.id, data.playerName);
          callback({ success: true, room: gm.serializeRoom(room) });
          await gm.broadcastRooms();
        } catch (err) {
          console.error("Error creating room:", err);
          callback({ success: false, error: "Failed to create room" });
        }
      }
    );

    socket.on(
      "room:join",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: any) => void
      ) => {
        try {
          const room = await gm.joinRoom(data.roomId, data.playerName, socket);
          if (!room) {
            callback({ success: false, error: "Room not found" });
            return;
          }
          callback({ success: true, room: gm.serializeRoom(room) });
        } catch (err) {
          console.error("Error joining room:", err);
          callback({ success: false, error: "Failed to join room" });
        }
      }
    );

    socket.on(
      "room:rejoin",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: any) => void
      ) => {
        try {
          const room = await gm.rejoinRoom(data.roomId, data.playerName, socket);
          if (!room) {
            callback({ success: false, error: "Room not found or not a participant" });
            return;
          }
          callback({ success: true, room: gm.serializeRoom(room) });
        } catch (err) {
          console.error("Error rejoining room:", err);
          callback({ success: false, error: "Failed to rejoin room" });
        }
      }
    );

    socket.on(
      "room:leave",
      async (
        data: { roomId: string; playerName: string },
        callback: (res: any) => void
      ) => {
        try {
          const closed = await gm.closeRoom(data.roomId, data.playerName);
          socket.leave(data.roomId);
          callback({ success: closed });
        } catch (err) {
          console.error("Error leaving room:", err);
          callback({ success: false, error: "Failed to leave room" });
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
        callback: (res: any) => void
      ) => {
        const result = await gm.makeMove(
          data.roomId,
          data.playerName,
          data.from,
          data.to,
          data.promotion
        );
        callback(result);
      }
    );

    socket.on(
      "game:undo-request",
      (data: { roomId: string; playerName: string; moveCount: number }) => {
        gm.requestUndo(data.roomId, data.playerName, data.moveCount);
        socket.to(data.roomId).emit("game:undo-request", {
          playerName: data.playerName,
        });
      }
    );

    socket.on(
      "game:undo-response",
      async (data: { roomId: string; accepted: boolean }) => {
        if (data.accepted) {
          await gm.undoToPlayer(data.roomId);
        } else {
          io.to(data.roomId).emit("game:undo-declined");
        }
      }
    );

    socket.on(
      "game:resign",
      async (data: { roomId: string; playerName: string }) => {
        await gm.resign(data.roomId, data.playerName);
      }
    );

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);
      const playerName = socketPlayers.get(socket.id);
      if (playerName) {
        socketPlayers.delete(socket.id);
        await gm.closeWaitingRoomsByOwner(playerName);
      }
    });
  });
}
