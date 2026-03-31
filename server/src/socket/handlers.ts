import { Server, Socket } from "socket.io";
import { GameManager } from "../game/GameManager";
import { ColorChoice } from "../models/Room";
import { emitOnlinePlayerCount, emitOnlinePlayerCountToSocket } from "./onlinePlayerCount";

const socketPlayers = new Map<string, string>();
const socketDisplayNames = new Map<string, string>();
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

const RESERVED_NAME_PATTERN = /^stockfish/i;

function isReservedName(name: string): boolean {
  return RESERVED_NAME_PATTERN.test(name);
}

function getSessionUser(socket: Socket): { userId?: string; displayName?: string } | undefined {
  const req = socket.request as unknown as Record<string, unknown>;
  const sess = req["session"] as Record<string, unknown> | undefined;
  const passport = sess?.["passport"] as Record<string, unknown> | undefined;
  const user = passport?.["user"] as { userId?: string; displayName?: string } | undefined;
  return user;
}

function getSocketUserId(socket: Socket, authEnabled: boolean): string | null {
  if (authEnabled) {
    const uid = typeof socket.data["userId"] === "string" ? socket.data["userId"] as string : "";
    return uid || null;
  }
  return socketPlayers.get(socket.id) ?? null;
}

export function getSocketDisplayName(socket: Socket, authEnabled: boolean): string {
  if (authEnabled) {
    return typeof socket.data["displayName"] === "string" ? socket.data["displayName"] as string : "";
  }
  return socketDisplayNames.get(socket.id) ?? socketPlayers.get(socket.id) ?? "";
}

function resolveEntryUserId(socket: Socket, clientUserId: string, authEnabled: boolean): string | null {
  if (authEnabled) {
    const uid = typeof socket.data["userId"] === "string" ? socket.data["userId"] as string : "";
    return uid || null;
  }
  return clientUserId || null;
}

function resolveEntryDisplayName(socket: Socket, clientDisplayName: string | undefined, uid: string, authEnabled: boolean): string {
  if (authEnabled) {
    return typeof socket.data["displayName"] === "string" ? socket.data["displayName"] as string : uid;
  }
  return typeof clientDisplayName === "string" && clientDisplayName ? clientDisplayName : uid;
}

export function registerSocketHandlers(io: Server, gm: GameManager, samlEnabled = false): void {
  const safeCallback = (callback: unknown, res: Record<string, unknown>): void => {
    if (typeof callback === "function") callback(res);
  };

  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    if (samlEnabled) {
      const sessionUser = getSessionUser(socket);
      if (sessionUser?.userId) {
        socket.data["userId"] = sessionUser.userId;
        socket.data["displayName"] = sessionUser.displayName ?? sessionUser.userId;
      }
    }

    socket.on("rooms:list", async () => {
      await gm.broadcastRooms();
    });

    socket.on(
      "room:create",
      async (
        data: {
          userId?: string;
          displayName?: string;
          timeControl: number;
          increment: number;
          colorChoice: ColorChoice;
          isPrivate?: boolean;
        },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data)) { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const clientUid = typeof data.userId === "string" ? data.userId : "";
          const uid = resolveEntryUserId(socket, clientUid, samlEnabled);
          if (!uid) { safeCallback(callback, { success: false, error: samlEnabled ? "Unauthorized" : "Invalid payload" }); return; }
          if (isReservedName(uid)) {
            safeCallback(callback, { success: false, error: "Reserved name" });
            return;
          }
          const isPrivate = data.isPrivate === true;
          if (isPrivate && process.env["FEATURE_PRIVATE_GAMES"] === "false") {
            safeCallback(callback, { success: false, error: "Feature disabled" });
            return;
          }
          const displayName = resolveEntryDisplayName(socket, data.displayName, uid, samlEnabled);
          const room = await gm.createRoom(
            uid,
            data.timeControl,
            data.increment,
            data.colorChoice,
            isPrivate,
            displayName
          );
          socket.join(room.roomId);
          socketPlayers.set(socket.id, uid);
          socketDisplayNames.set(socket.id, displayName);
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
        data: { roomId: string; userId?: string; displayName?: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const clientUid = typeof data.userId === "string" ? data.userId : "";
          const joinUid = resolveEntryUserId(socket, clientUid, samlEnabled);
          if (!joinUid) { safeCallback(callback, { success: false, error: samlEnabled ? "Unauthorized" : "Invalid payload" }); return; }
          if (isReservedName(joinUid)) { safeCallback(callback, { success: false, error: "Reserved name" }); return; }
          const displayName = resolveEntryDisplayName(socket, data.displayName, joinUid, samlEnabled);
          const room = await gm.joinRoom(data.roomId, joinUid, socket, displayName);
          if (!room) {
            safeCallback(callback, { success: false, error: "Room not found" });
            return;
          }
          socketPlayers.set(socket.id, joinUid);
          socketDisplayNames.set(socket.id, displayName);
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
        data: { roomId: string; userId?: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
          const clientUid = typeof data.userId === "string" ? data.userId : "";
          const rejoinUid = resolveEntryUserId(socket, clientUid, samlEnabled);
          if (!rejoinUid) { safeCallback(callback, { success: false, error: samlEnabled ? "Unauthorized" : "Invalid payload" }); return; }
          const room = await gm.rejoinRoom(data.roomId, rejoinUid, socket);
          if (!room) {
            safeCallback(callback, { success: false, error: "Room not found or not a participant" });
            return;
          }
          socketPlayers.set(socket.id, rejoinUid);
          trackSocketRoom(socket.id, data.roomId);
          await gm.handlePlayerReconnect(data.roomId, rejoinUid);
          safeCallback(callback, { success: true, room: gm.serializeRoom(room) });
          const rematchOffer = gm.getRematchOffer(data.roomId);
          if (rematchOffer) {
            socket.emit("game:rematch-offer", { userId: rematchOffer });
          }
        } catch (err) {
          console.error("Error rejoining room:", err);
          safeCallback(callback, { success: false, error: "Failed to rejoin room" });
        }
      }
    );

    socket.on(
      "room:leave",
      async (
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        try {
          if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false }); return; }
          const leaveUid = getSocketUserId(socket, samlEnabled);
          if (!leaveUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
          const closed = await gm.closeRoom(data.roomId, leaveUid);
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
          from: string;
          to: string;
          promotion?: string;
        },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const moveUid = getSocketUserId(socket, samlEnabled);
        if (!moveUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.makeMove(
          data.roomId,
          moveUid,
          data.from,
          data.to,
          data.promotion
        );
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:undo-request",
      (data: { roomId: string; moveCount: number }) => {
        if (!isObj(data) || typeof data.roomId !== "string") return;
        const undoUid = getSocketUserId(socket, samlEnabled);
        if (!undoUid) return;
        gm.requestUndo(data.roomId, undoUid, data.moveCount);
        socket.to(data.roomId).emit("game:undo-request", {
          userId: undoUid,
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
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const giveUid = getSocketUserId(socket, samlEnabled);
        if (!giveUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.giveTime(data.roomId, giveUid);
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:draw-offer",
      async (
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const drawUid = getSocketUserId(socket, samlEnabled);
        if (!drawUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.offerDraw(data.roomId, drawUid);
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:draw-response",
      async (data: { roomId: string; accepted: boolean }) => {
        if (!isObj(data) || typeof data.roomId !== "string") return;
        const drawRespUid = getSocketUserId(socket, samlEnabled);
        if (!drawRespUid) return;
        await gm.respondDraw(data.roomId, drawRespUid, data.accepted);
      }
    );

    socket.on(
      "game:chat",
      async (
        data: { roomId: string; text: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (
          !isObj(data) ||
          typeof data.roomId !== "string" ||
          typeof data.text !== "string"
        ) {
          safeCallback(callback, { success: false, error: "Invalid payload" });
          return;
        }
        const chatUid = getSocketUserId(socket, samlEnabled);
        if (!chatUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.sendChatMessage(
          data.roomId,
          chatUid,
          data.text
        );
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:resign",
      async (data: { roomId: string }) => {
        if (!isObj(data) || typeof data.roomId !== "string") return;
        const resignUid = getSocketUserId(socket, samlEnabled);
        if (!resignUid) return;
        await gm.resign(data.roomId, resignUid);
      }
    );

    socket.on(
      "game:player-left",
      async (data: { roomId: string }) => {
        if (!isObj(data) || typeof data.roomId !== "string") return;
        const leftUid = getSocketUserId(socket, samlEnabled);
        if (!leftUid) return;
        await gm.handlePlayerDisconnect(data.roomId, leftUid);
      }
    );

    socket.on(
      "game:claim-disconnect-win",
      async (
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const claimWinUid = getSocketUserId(socket, samlEnabled);
        if (!claimWinUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.claimDisconnectResult(data.roomId, claimWinUid, "win");
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:claim-disconnect-draw",
      async (
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const claimDrawUid = getSocketUserId(socket, samlEnabled);
        if (!claimDrawUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.claimDisconnectResult(data.roomId, claimDrawUid, "draw");
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:rematch-offer",
      async (
        data: { roomId: string },
        callback: (res: Record<string, unknown>) => void
      ) => {
        if (!isObj(data) || typeof data.roomId !== "string") { safeCallback(callback, { success: false, error: "Invalid payload" }); return; }
        const rematchUid = getSocketUserId(socket, samlEnabled);
        if (!rematchUid) { safeCallback(callback, { success: false, error: "Unauthorized" }); return; }
        const result = await gm.offerRematch(data.roomId, rematchUid);
        safeCallback(callback, result);
      }
    );

    socket.on(
      "game:rematch-cancel",
      (data: { roomId: string }) => {
        if (!isObj(data) || typeof data.roomId !== "string") return;
        gm.cancelRematch(data.roomId);
      }
    );

    socket.on("presence:request-count", () => {
      emitOnlinePlayerCountToSocket(io, socket);
    });

    socket.on("ping:latency", (data: unknown, callback: unknown) => {
      safeCallback(callback, { ts: isObj(data) && typeof data["ts"] === "number" ? data["ts"] : 0 });
    });

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);
      const userId = socketPlayers.get(socket.id);
      const rooms = socketRooms.get(socket.id);
      socketPlayers.delete(socket.id);
      socketDisplayNames.delete(socket.id);
      socketRooms.delete(socket.id);

      if (userId) {
        await gm.closeWaitingRoomsByOwner(userId);

        if (rooms) {
          for (const roomId of rooms) {
            await gm.handlePlayerDisconnect(roomId, userId);
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
