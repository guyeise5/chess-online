import { Chess } from "chess.js";
import { Server, Socket } from "socket.io";
import Room, { IRoom, TIME_CONTROLS, TimeFormat, ColorChoice } from "../models/Room";
import { v4 as uuidv4 } from "uuid";

interface TimerState {
  interval: NodeJS.Timeout | null;
  lastTick: number;
}

export class GameManager {
  private io: Server;
  private timers: Map<string, TimerState> = new Map();
  private games: Map<string, Chess> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  async createRoom(
    ownerName: string,
    timeFormat: TimeFormat,
    colorChoice: ColorChoice
  ): Promise<IRoom> {
    const roomId = uuidv4().slice(0, 8);
    const tc = TIME_CONTROLS[timeFormat];

    const room = new Room({
      roomId,
      owner: ownerName,
      timeFormat,
      timeControl: tc.time,
      timeIncrement: tc.timeIncrement,
      colorChoice,
      whiteTime: tc.time,
      blackTime: tc.time,
    });

    await room.save();
    return room;
  }

  async getRooms(): Promise<IRoom[]> {
    return Room.find({ status: "waiting" }).sort({ createdAt: -1 });
  }

  async joinRoom(
    roomId: string,
    playerName: string,
    socket: Socket
  ): Promise<IRoom | null> {
    const room = await Room.findOne({ roomId });
    if (!room) return null;

    socket.join(roomId);

    if (room.status === "playing" || room.status === "finished") {
      return room;
    }

    if (room.owner === playerName) {
      return room;
    }

    room.opponent = playerName;
    this.assignColors(room);
    room.status = "playing";
    room.lastMoveAt = new Date();
    await room.save();

    const chess = new Chess();
    this.games.set(roomId, chess);

    this.io.to(roomId).emit("game:start", this.serializeRoom(room));
    this.startTimer(roomId);
    this.broadcastRooms();

    return room;
  }

  async rejoinRoom(
    roomId: string,
    playerName: string,
    socket: Socket
  ): Promise<IRoom | null> {
    const room = await Room.findOne({ roomId });
    if (!room) return null;

    const isOwner = room.owner === playerName;
    const isOpponent = room.opponent === playerName;
    if (!isOwner && !isOpponent) return null;

    socket.join(roomId);

    if (room.status === "playing" && !this.timers.has(roomId)) {
      if (!this.games.has(roomId)) {
        this.games.set(roomId, new Chess(room.fen));
      }
      this.startTimer(roomId);
    }

    return room;
  }

  private assignColors(room: IRoom): void {
    if (room.colorChoice === "white") {
      room.whitePlayer = room.owner;
      room.blackPlayer = room.opponent;
    } else if (room.colorChoice === "black") {
      room.blackPlayer = room.owner;
      room.whitePlayer = room.opponent;
    } else {
      if (Math.random() < 0.5) {
        room.whitePlayer = room.owner;
        room.blackPlayer = room.opponent;
      } else {
        room.blackPlayer = room.owner;
        room.whitePlayer = room.opponent;
      }
    }
  }

  async makeMove(
    roomId: string,
    playerName: string,
    from: string,
    to: string,
    promotion?: string
  ): Promise<{ success: boolean; room?: IRoom; error?: string }> {
    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") {
      return { success: false, error: "Game not active" };
    }

    const isWhite = room.whitePlayer === playerName;
    const isBlack = room.blackPlayer === playerName;
    if (!isWhite && !isBlack) {
      return { success: false, error: "Not a player in this game" };
    }

    if ((room.turn === "w" && !isWhite) || (room.turn === "b" && !isBlack)) {
      return { success: false, error: "Not your turn" };
    }

    let chess = this.games.get(roomId);
    if (!chess) {
      chess = new Chess(room.fen);
      this.games.set(roomId, chess);
    }

    try {
      const move = chess.move({ from, to, promotion: promotion || "q" });
      if (!move) {
        return { success: false, error: "Illegal move" };
      }

      const now = Date.now();
      const timerState = this.timers.get(roomId);
      if (timerState && room.lastMoveAt) {
        const elapsed = (now - timerState.lastTick) / 1000;
        if (room.turn === "w") {
          room.whiteTime = Math.max(0, room.whiteTime - elapsed + room.timeIncrement);
        } else {
          room.blackTime = Math.max(0, room.blackTime - elapsed + room.timeIncrement);
        }
        timerState.lastTick = now;
      }

      room.fen = chess.fen();
      room.pgn = chess.pgn();
      room.turn = chess.turn() as "w" | "b";
      room.moves.push(move.san);
      room.lastMoveAt = new Date();

      let result: string | null = null;
      if (chess.isCheckmate()) {
        result = room.turn === "w" ? "0-1" : "1-0";
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        result = "1/2-1/2";
      }

      if (result) {
        room.result = result;
        room.status = "finished";
        this.stopTimer(roomId);
        this.games.delete(roomId);
      }

      await room.save();

      this.io.to(roomId).emit("game:move", {
        move: { from, to, promotion, san: move.san },
        fen: room.fen,
        turn: room.turn,
        whiteTime: room.whiteTime,
        blackTime: room.blackTime,
        result: room.result,
        status: room.status,
      });

      return { success: true, room };
    } catch {
      return { success: false, error: "Invalid move" };
    }
  }

  async closeRoom(roomId: string, playerName: string): Promise<boolean> {
    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "waiting" || room.owner !== playerName) {
      return false;
    }

    await Room.deleteOne({ roomId });
    this.io.to(roomId).emit("room:closed");
    this.io.in(roomId).socketsLeave(roomId);
    await this.broadcastRooms();
    return true;
  }

  async resign(roomId: string, playerName: string): Promise<void> {
    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") return;

    const isWhite = room.whitePlayer === playerName;
    room.result = isWhite ? "0-1" : "1-0";
    room.status = "finished";
    await room.save();

    this.stopTimer(roomId);
    this.games.delete(roomId);

    this.io.to(roomId).emit("game:over", {
      result: room.result,
      reason: "resignation",
    });
    this.broadcastRooms();
  }

  private startTimer(roomId: string): void {
    const timerState: TimerState = {
      interval: null,
      lastTick: Date.now(),
    };

    timerState.interval = setInterval(async () => {
      const room = await Room.findOne({ roomId });
      if (!room || room.status !== "playing") {
        this.stopTimer(roomId);
        return;
      }

      const now = Date.now();
      const elapsed = (now - timerState.lastTick) / 1000;
      timerState.lastTick = now;

      if (room.turn === "w") {
        room.whiteTime = Math.max(0, room.whiteTime - elapsed);
      } else {
        room.blackTime = Math.max(0, room.blackTime - elapsed);
      }

      if (room.whiteTime <= 0 || room.blackTime <= 0) {
        room.result = room.whiteTime <= 0 ? "0-1" : "1-0";
        room.status = "finished";
        await room.save();
        this.stopTimer(roomId);
        this.games.delete(roomId);

        this.io.to(roomId).emit("game:over", {
          result: room.result,
          reason: "timeout",
        });
        this.broadcastRooms();
        return;
      }

      await room.save();

      this.io.to(roomId).emit("game:timer", {
        whiteTime: room.whiteTime,
        blackTime: room.blackTime,
      });
    }, 1000);

    this.timers.set(roomId, timerState);
  }

  private stopTimer(roomId: string): void {
    const timerState = this.timers.get(roomId);
    if (timerState?.interval) {
      clearInterval(timerState.interval);
    }
    this.timers.delete(roomId);
  }

  stopAllTimers(): void {
    for (const [roomId] of this.timers) {
      this.stopTimer(roomId);
    }
  }

  async broadcastRooms(): Promise<void> {
    const rooms = await this.getRooms();
    this.io.emit("rooms:list", rooms.map((r) => this.serializeRoom(r)));
  }

  serializeRoom(room: IRoom) {
    return {
      roomId: room.roomId,
      owner: room.owner,
      opponent: room.opponent,
      timeFormat: room.timeFormat,
      timeControl: room.timeControl,
      increment: room.timeIncrement,
      colorChoice: room.colorChoice,
      status: room.status,
      fen: room.fen,
      whitePlayer: room.whitePlayer,
      blackPlayer: room.blackPlayer,
      whiteTime: room.whiteTime,
      blackTime: room.blackTime,
      turn: room.turn,
      result: room.result,
      moves: room.moves,
    };
  }
}
