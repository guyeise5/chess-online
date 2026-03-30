import { Chess } from "chess.js";
import { Server, Socket } from "socket.io";
import Room, { IRoom, IChatMessage, deriveTimeFormat, ColorChoice } from "../models/Room";
import { v4 as uuidv4 } from "uuid";

interface TimerState {
  interval: NodeJS.Timeout | null;
  lastTick: number;
}

interface UndoRequest {
  userId: string;
  moveCount: number;
}

interface DrawOfferState {
  offeredBy: string;
  moveCountAtOffer: number;
}

interface DisconnectState {
  userId: string;
  timeout: NodeJS.Timeout;
  disconnectedAt: number;
  claimAvailable: boolean;
}

export const DISCONNECT_GRACE_PERIOD_MS = 10_000;

export class GameManager {
  private io: Server;
  private timers: Map<string, TimerState> = new Map();
  private games: Map<string, Chess> = new Map();
  private undoRequests: Map<string, UndoRequest> = new Map();
  private drawOffers: Map<string, DrawOfferState> = new Map();
  private drawOfferCooldowns: Map<string, DrawOfferState> = new Map();
  private disconnectTimers: Map<string, DisconnectState> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  async createRoom(
    ownerUserId: string,
    timeControl: number,
    increment: number,
    colorChoice: ColorChoice,
    isPrivate: boolean = false,
    ownerDisplayName?: string
  ): Promise<IRoom> {
    const roomId = uuidv4().slice(0, 8);
    const timeFormat = deriveTimeFormat(timeControl, increment);

    const room = new Room({
      roomId,
      owner: ownerUserId,
      ownerName: ownerDisplayName ?? ownerUserId,
      timeFormat,
      timeControl,
      timeIncrement: increment,
      colorChoice,
      isPrivate,
      whiteTime: timeControl,
      blackTime: timeControl,
    });

    await room.save();
    return room;
  }

  async getRooms(): Promise<IRoom[]> {
    return Room.find({ status: "waiting", isPrivate: { $ne: true } }).sort({ createdAt: -1 });
  }

  async getPrivateRoomInfo(roomId: string): Promise<IRoom | null> {
    if (process.env["FEATURE_PRIVATE_GAMES"] === "false") return null;
    const room = await Room.findOne({ roomId, isPrivate: true });
    if (!room) return null;
    return room;
  }

  async joinRoom(
    roomId: string,
    userId: string,
    socket: Socket,
    displayName?: string
  ): Promise<IRoom | null> {
    const room = await Room.findOne({ roomId });
    if (!room) return null;

    socket.join(roomId);

    if (room.status === "playing" || room.status === "finished") {
      return room;
    }

    if (room.owner === userId) {
      return room;
    }

    room.opponent = userId;
    room.opponentName = displayName ?? userId;
    this.assignColors(room);
    room.status = "playing";
    room.lastMoveAt = new Date();
    if (process.env["FEATURE_GAME_CHAT"] !== "false") {
      room.chatMessages.push({
        type: "system",
        text: "Game started — good luck!",
        timestamp: Date.now(),
      });
    }
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
    userId: string,
    socket: Socket
  ): Promise<IRoom | null> {
    const room = await Room.findOne({ roomId });
    if (!room) return null;

    const isOwner = room.owner === userId;
    const isOpponent = room.opponent === userId;
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
      room.whiteName = room.ownerName || room.owner;
      room.blackPlayer = room.opponent;
      room.blackName = room.opponentName || room.opponent;
    } else if (room.colorChoice === "black") {
      room.blackPlayer = room.owner;
      room.blackName = room.ownerName || room.owner;
      room.whitePlayer = room.opponent;
      room.whiteName = room.opponentName || room.opponent;
    } else {
      if (Math.random() < 0.5) {
        room.whitePlayer = room.owner;
        room.whiteName = room.ownerName || room.owner;
        room.blackPlayer = room.opponent;
        room.blackName = room.opponentName || room.opponent;
      } else {
        room.blackPlayer = room.owner;
        room.blackName = room.ownerName || room.owner;
        room.whitePlayer = room.opponent;
        room.whiteName = room.opponentName || room.opponent;
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
      let gameOverReason = "";
      if (chess.isCheckmate()) {
        result = room.turn === "w" ? "0-1" : "1-0";
        gameOverReason = "checkmate";
      } else if (chess.isStalemate()) {
        result = "1/2-1/2";
        gameOverReason = "stalemate";
      } else if (chess.isThreefoldRepetition()) {
        result = "1/2-1/2";
        gameOverReason = "threefold repetition";
      } else if (chess.isInsufficientMaterial()) {
        result = "1/2-1/2";
        gameOverReason = "insufficient material";
      } else if (chess.isDraw()) {
        result = "1/2-1/2";
        gameOverReason = "50-move rule";
      }

      if (result) {
        room.result = result;
        room.status = "finished";
        this.stopTimer(roomId);
        this.games.delete(roomId);
        this.drawOffers.delete(roomId);
        this.drawOfferCooldowns.delete(roomId);

        const label = result === "1-0" ? "White wins" : result === "0-1" ? "Black wins" : "Draw";
        await this.emitSystemChat(roomId, `${label} — ${gameOverReason}`);
      }

      if (this.undoRequests.has(roomId)) {
        this.undoRequests.delete(roomId);
        this.io.to(roomId).emit("game:undo-cancelled");
      }

      if (this.drawOffers.has(roomId)) {
        const offer = this.drawOffers.get(roomId)!;
        this.drawOfferCooldowns.set(roomId, { ...offer });
        this.drawOffers.delete(roomId);
        this.io.to(roomId).emit("game:draw-cancelled");
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

  async closeWaitingRoomsByOwner(playerName: string): Promise<void> {
    const rooms = await Room.find({ owner: playerName, status: "waiting" });
    for (const room of rooms) {
      await Room.deleteOne({ roomId: room.roomId });
      this.io.to(room.roomId).emit("room:closed");
      this.io.in(room.roomId).socketsLeave(room.roomId);
    }
    if (rooms.length > 0) {
      await this.broadcastRooms();
    }
  }

  requestUndo(roomId: string, userId: string, moveCount: number): void {
    this.undoRequests.set(roomId, { userId, moveCount });
  }

  getUndoRequest(roomId: string): UndoRequest | undefined {
    return this.undoRequests.get(roomId);
  }

  async undoToPlayer(
    roomId: string
  ): Promise<{ success: boolean; room?: IRoom }> {
    const request = this.undoRequests.get(roomId);
    if (!request) return { success: false };
    this.undoRequests.delete(roomId);

    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing" || room.moves.length === 0) {
      return { success: false };
    }

    let chess = this.games.get(roomId);
    if (!chess) {
      chess = new Chess(room.fen);
      this.games.set(roomId, chess);
    }

    const requesterIsWhite = room.whitePlayer === request.userId;
    const targetTurn = requesterIsWhite ? "w" : "b";

    let undoCount = 0;
    while (chess.history().length > 0 && undoCount < 2) {
      if (undoCount > 0 && chess.turn() === targetTurn) break;
      const undone = chess.undo();
      if (!undone) break;
      room.moves.pop();
      undoCount++;
    }

    if (undoCount === 0) return { success: false };

    if (this.drawOffers.has(roomId)) {
      this.drawOffers.delete(roomId);
      this.io.to(roomId).emit("game:draw-cancelled");
    }
    this.drawOfferCooldowns.delete(roomId);

    room.fen = chess.fen();
    room.pgn = chess.pgn();
    room.turn = chess.turn() as "w" | "b";
    room.lastMoveAt = new Date();
    await room.save();

    this.io.to(roomId).emit("game:undo", {
      fen: room.fen,
      turn: room.turn,
      whiteTime: room.whiteTime,
      blackTime: room.blackTime,
      moves: room.moves,
    });

    return { success: true, room };
  }

  async giveTime(
    roomId: string,
    giverName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (process.env["FEATURE_GIVE_TIME"] === "false") {
      return { success: false, error: "Feature disabled" };
    }

    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") {
      return { success: false, error: "Game not active" };
    }

    const isWhite = room.whitePlayer === giverName;
    const isBlack = room.blackPlayer === giverName;
    if (!isWhite && !isBlack) {
      return { success: false, error: "Not a player in this game" };
    }

    if (isWhite) {
      room.blackTime += 15;
    } else {
      room.whiteTime += 15;
    }
    await room.save();

    this.io.to(roomId).emit("game:timer", {
      whiteTime: room.whiteTime,
      blackTime: room.blackTime,
    });

    const giverDisplay = (isWhite ? room.whiteName : room.blackName) || giverName;
    await this.emitSystemChat(roomId, `${giverDisplay} gave 15 seconds`);

    return { success: true };
  }

  async offerDraw(
    roomId: string,
    playerName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (process.env["FEATURE_DRAW_OFFER"] === "false") {
      return { success: false, error: "Feature disabled" };
    }

    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") {
      return { success: false, error: "Game not active" };
    }

    const isWhite = room.whitePlayer === playerName;
    const isBlack = room.blackPlayer === playerName;
    if (!isWhite && !isBlack) {
      return { success: false, error: "Not a player in this game" };
    }

    if (this.drawOffers.has(roomId)) {
      return { success: false, error: "Draw already offered" };
    }

    const cooldown = this.drawOfferCooldowns.get(roomId);
    if (cooldown && cooldown.offeredBy === playerName) {
      const opponentMovesNow = isWhite
        ? Math.floor(room.moves.length / 2)
        : Math.ceil(room.moves.length / 2);
      const opponentMovesAtOffer = isWhite
        ? Math.floor(cooldown.moveCountAtOffer / 2)
        : Math.ceil(cooldown.moveCountAtOffer / 2);
      if (opponentMovesNow <= opponentMovesAtOffer) {
        return { success: false, error: "Must wait for opponent to move" };
      }
    }

    this.drawOffers.set(roomId, {
      offeredBy: playerName,
      moveCountAtOffer: room.moves.length,
    });

    this.io.to(roomId).emit("game:draw-offer", { userId: playerName });
    return { success: true };
  }

  async respondDraw(
    roomId: string,
    playerName: string,
    accepted: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const offer = this.drawOffers.get(roomId);
    if (!offer) {
      return { success: false, error: "No pending draw offer" };
    }

    if (offer.offeredBy === playerName) {
      return { success: false, error: "Cannot respond to your own offer" };
    }

    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") {
      return { success: false, error: "Game not active" };
    }

    const isPlayer =
      room.whitePlayer === playerName || room.blackPlayer === playerName;
    if (!isPlayer) {
      return { success: false, error: "Not a player in this game" };
    }

    if (accepted) {
      this.drawOffers.delete(roomId);
      this.drawOfferCooldowns.delete(roomId);

      room.result = "1/2-1/2";
      room.status = "finished";
      await room.save();

      this.stopTimer(roomId);
      this.games.delete(roomId);

      await this.emitSystemChat(roomId, "Draw — mutual agreement");

      this.io.to(roomId).emit("game:over", {
        result: "1/2-1/2",
        reason: "mutual agreement",
      });
      this.broadcastRooms();
    } else {
      this.drawOfferCooldowns.set(roomId, { ...offer });
      this.drawOffers.delete(roomId);
      this.io.to(roomId).emit("game:draw-declined");
    }

    return { success: true };
  }

  getDrawOffer(roomId: string): DrawOfferState | undefined {
    return this.drawOffers.get(roomId);
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
    this.drawOffers.delete(roomId);
    this.drawOfferCooldowns.delete(roomId);

    const resignLabel = room.result === "1-0" ? "White wins" : "Black wins";
    await this.emitSystemChat(roomId, `${resignLabel} — resignation`);

    this.io.to(roomId).emit("game:over", {
      result: room.result,
      reason: "resignation",
    });
    this.broadcastRooms();
  }

  async handlePlayerDisconnect(roomId: string, userId: string): Promise<void> {
    if (process.env["FEATURE_DISCONNECT_CLAIM"] === "false") return;

    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") return;

    const isPlayer = room.whitePlayer === userId || room.blackPlayer === userId;
    if (!isPlayer) return;

    if (this.disconnectTimers.has(roomId)) return;

    this.io.to(roomId).emit("game:opponent-disconnected", { userId });

    const timeout = setTimeout(async () => {
      const state = this.disconnectTimers.get(roomId);
      if (state) {
        state.claimAvailable = true;
        this.io.to(roomId).emit("game:disconnect-claim-available", { userId });
      }
    }, DISCONNECT_GRACE_PERIOD_MS);

    this.disconnectTimers.set(roomId, {
      userId,
      timeout,
      disconnectedAt: Date.now(),
      claimAvailable: false,
    });
  }

  async handlePlayerReconnect(roomId: string, userId: string): Promise<void> {
    const state = this.disconnectTimers.get(roomId);
    if (!state || state.userId !== userId) return;

    clearTimeout(state.timeout);
    this.disconnectTimers.delete(roomId);

    this.io.to(roomId).emit("game:opponent-reconnected", { userId });
  }

  async claimDisconnectResult(
    roomId: string,
    claimerUserId: string,
    claimType: "win" | "draw"
  ): Promise<{ success: boolean; error?: string }> {
    const state = this.disconnectTimers.get(roomId);
    if (!state) return { success: false, error: "No pending disconnect" };
    if (!state.claimAvailable) return { success: false, error: "Grace period not elapsed" };
    if (state.userId === claimerUserId) return { success: false, error: "Cannot claim against yourself" };

    const room = await Room.findOne({ roomId });
    if (!room || room.status !== "playing") return { success: false, error: "Game not active" };

    const isPlayer = room.whitePlayer === claimerUserId || room.blackPlayer === claimerUserId;
    if (!isPlayer) return { success: false, error: "Not a player in this game" };

    clearTimeout(state.timeout);
    this.disconnectTimers.delete(roomId);

    if (claimType === "draw") {
      room.result = "1/2-1/2";
    } else {
      const claimerIsWhite = room.whitePlayer === claimerUserId;
      room.result = claimerIsWhite ? "1-0" : "0-1";
    }
    room.status = "finished";
    await room.save();

    this.stopTimer(roomId);
    this.games.delete(roomId);

    const claimLabel = room.result === "1-0" ? "White wins" : room.result === "0-1" ? "Black wins" : "Draw";
    const claimReason = claimType === "draw" ? "opponent left — draw claimed" : "opponent left";
    await this.emitSystemChat(roomId, `${claimLabel} — ${claimReason}`);

    this.io.to(roomId).emit("game:over", {
      result: room.result,
      reason: claimReason,
    });
    this.broadcastRooms();

    return { success: true };
  }

  getDisconnectState(roomId: string): DisconnectState | undefined {
    return this.disconnectTimers.get(roomId);
  }

  private async pushChatMessage(
    roomId: string,
    msg: IChatMessage
  ): Promise<void> {
    if (process.env["FEATURE_GAME_CHAT"] === "false") return;

    await Room.updateOne({ roomId }, { $push: { chatMessages: msg } });
    this.io.to(roomId).emit("game:chat", msg);
  }

  async sendChatMessage(
    roomId: string,
    userId: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    if (process.env["FEATURE_GAME_CHAT"] === "false") {
      return { success: false, error: "Feature disabled" };
    }

    const room = await Room.findOne({ roomId });
    if (!room) return { success: false, error: "Room not found" };

    const isWhite = room.whitePlayer === userId;
    const isBlack = room.blackPlayer === userId;
    if (!isWhite && !isBlack) return { success: false, error: "Not a player in this game" };

    const trimmed = typeof text === "string" ? text.trim().slice(0, 500) : "";
    if (!trimmed) return { success: false, error: "Empty message" };

    const senderDisplay = (isWhite ? room.whiteName : room.blackName) || userId;
    await this.pushChatMessage(roomId, {
      type: "player",
      sender: senderDisplay,
      text: trimmed,
      timestamp: Date.now(),
    });

    return { success: true };
  }

  async emitSystemChat(roomId: string, text: string): Promise<void> {
    await this.pushChatMessage(roomId, {
      type: "system",
      text,
      timestamp: Date.now(),
    });
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

        const timeoutLabel = room.result === "1-0" ? "White wins" : "Black wins";
        await this.emitSystemChat(roomId, `${timeoutLabel} — timeout`);

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
    for (const [, state] of this.disconnectTimers) {
      clearTimeout(state.timeout);
    }
    this.disconnectTimers.clear();
    this.drawOffers.clear();
    this.drawOfferCooldowns.clear();
  }

  async broadcastRooms(): Promise<void> {
    const rooms = await this.getRooms();
    this.io.emit("rooms:list", rooms.map((r) => this.serializeRoom(r)));
  }

  serializeRoom(room: IRoom) {
    return {
      roomId: room.roomId,
      owner: room.owner,
      ownerName: room.ownerName || room.owner,
      opponent: room.opponent,
      opponentName: room.opponentName || room.opponent,
      timeFormat: room.timeFormat,
      timeControl: room.timeControl,
      increment: room.timeIncrement,
      colorChoice: room.colorChoice,
      isPrivate: room.isPrivate,
      status: room.status,
      fen: room.fen,
      whitePlayer: room.whitePlayer,
      blackPlayer: room.blackPlayer,
      whiteName: room.whiteName || room.whitePlayer,
      blackName: room.blackName || room.blackPlayer,
      whiteTime: room.whiteTime,
      blackTime: room.blackTime,
      turn: room.turn,
      result: room.result,
      moves: room.moves,
      chatMessages: (room.chatMessages ?? []).map((m) => ({
        type: m.type,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
      })),
    };
  }
}
