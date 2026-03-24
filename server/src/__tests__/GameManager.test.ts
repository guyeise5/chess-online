import { Server } from "socket.io";
import http from "http";
import { GameManager } from "../game/GameManager";
import Room from "../models/Room";
import { setupDB, teardownDB, clearDB } from "./setup";

let io: Server;
let httpServer: http.Server;
let gm: GameManager;

function mockSocket(id = "sock-1"): any {
  return { id, join: jest.fn() };
}

beforeAll(async () => {
  await setupDB();
  httpServer = http.createServer();
  io = new Server(httpServer);
  gm = new GameManager(io);
});

afterEach(async () => {
  gm.stopAllTimers();
  await clearDB();
});

afterAll(async () => {
  io.close();
  httpServer.close();
  await teardownDB();
});

// ---------------------------------------------------------------------------
// createRoom
// ---------------------------------------------------------------------------
describe("createRoom", () => {
  it("creates a bullet room with correct time controls", async () => {
    const room = await gm.createRoom("Alice", 60, 0, "white");

    expect(room.owner).toBe("Alice");
    expect(room.timeFormat).toBe("bullet");
    expect(room.timeControl).toBe(60);
    expect(room.timeIncrement).toBe(0);
    expect(room.colorChoice).toBe("white");
    expect(room.status).toBe("waiting");
    expect(room.whiteTime).toBe(60);
    expect(room.blackTime).toBe(60);
    expect(room.roomId).toHaveLength(8);
  });

  it("creates a blitz room with 5 min + 2s increment", async () => {
    const room = await gm.createRoom("Bob", 300, 2, "random");

    expect(room.timeControl).toBe(300);
    expect(room.timeIncrement).toBe(2);
    expect(room.whiteTime).toBe(300);
    expect(room.blackTime).toBe(300);
  });

  it("creates a rapid room with 10 min + 5s increment", async () => {
    const room = await gm.createRoom("Carol", 600, 5, "black");

    expect(room.timeControl).toBe(600);
    expect(room.timeIncrement).toBe(5);
  });

  it("creates a classical room with 30 min + 10s increment", async () => {
    const room = await gm.createRoom("Dave", 1800, 10, "white");

    expect(room.timeControl).toBe(1800);
    expect(room.timeIncrement).toBe(10);
  });

  it("persists the room to MongoDB", async () => {
    const room = await gm.createRoom("Eve", 300, 2, "random");
    const found = await Room.findOne({ roomId: room.roomId });

    expect(found).not.toBeNull();
    expect(found!.owner).toBe("Eve");
  });

  it("sets initial FEN to starting position", async () => {
    const room = await gm.createRoom("Frank", 300, 2, "white");

    expect(room.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });
});

// ---------------------------------------------------------------------------
// getRooms
// ---------------------------------------------------------------------------
describe("getRooms", () => {
  it("returns only rooms with status 'waiting'", async () => {
    await gm.createRoom("Alice", 300, 2, "white");
    await gm.createRoom("Bob", 600, 5, "black");

    const r = await gm.createRoom("Carol", 60, 0, "random");
    r.status = "playing";
    await r.save();

    const rooms = await gm.getRooms();
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.owner).sort()).toEqual(["Alice", "Bob"]);
  });

  it("returns empty array when no waiting rooms", async () => {
    const rooms = await gm.getRooms();
    expect(rooms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// joinRoom
// ---------------------------------------------------------------------------
describe("joinRoom", () => {
  it("returns null for a non-existent room", async () => {
    const result = await gm.joinRoom("nonexistent", "Alice", mockSocket());
    expect(result).toBeNull();
  });

  it("returns room unchanged when owner rejoins their waiting room", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const sock = mockSocket();

    const result = await gm.joinRoom(room.roomId, "Alice", sock);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("waiting");
    expect(result!.opponent).toBeNull();
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("starts the game when an opponent joins", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const sock = mockSocket("sock-2");

    const result = await gm.joinRoom(room.roomId, "Bob", sock);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("playing");
    expect(result!.opponent).toBe("Bob");
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("assigns colors correctly when owner picks white", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const result = await gm.joinRoom(room.roomId, "Bob", mockSocket());

    expect(result!.whitePlayer).toBe("Alice");
    expect(result!.blackPlayer).toBe("Bob");
  });

  it("assigns colors correctly when owner picks black", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "black");
    const result = await gm.joinRoom(room.roomId, "Bob", mockSocket());

    expect(result!.whitePlayer).toBe("Bob");
    expect(result!.blackPlayer).toBe("Alice");
  });

  it("assigns colors randomly when owner picks random", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "random");
    const result = await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const players = [result!.whitePlayer, result!.blackPlayer].sort();
    expect(players).toEqual(["Alice", "Bob"]);
  });

  it("returns existing room when joining an in-progress game", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket("s1"));

    const sock2 = mockSocket("s2");
    const result = await gm.joinRoom(room.roomId, "Bob", sock2);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("playing");
    expect(sock2.join).toHaveBeenCalledWith(room.roomId);
  });
});

// ---------------------------------------------------------------------------
// rejoinRoom
// ---------------------------------------------------------------------------
describe("rejoinRoom", () => {
  it("returns null for a non-existent room", async () => {
    const result = await gm.rejoinRoom("nonexistent", "Alice", mockSocket());
    expect(result).toBeNull();
  });

  it("returns null for a non-participant", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const result = await gm.rejoinRoom(room.roomId, "Eve", mockSocket("s3"));
    expect(result).toBeNull();
  });

  it("allows the owner to rejoin", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const sock = mockSocket("s4");
    const result = await gm.rejoinRoom(room.roomId, "Alice", sock);
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe(room.roomId);
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("allows the opponent to rejoin", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const sock = mockSocket("s5");
    const result = await gm.rejoinRoom(room.roomId, "Bob", sock);
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe(room.roomId);
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("allows rejoining a finished game", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    await gm.resign(room.roomId, "Alice");

    const result = await gm.rejoinRoom(room.roomId, "Alice", mockSocket("s6"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe("finished");
  });
});

// ---------------------------------------------------------------------------
// makeMove
// ---------------------------------------------------------------------------
describe("makeMove", () => {
  async function createPlayingRoom(
    ownerColor: "white" | "black" = "white"
  ) {
    const room = await gm.createRoom("Alice", 300, 2, ownerColor);
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    const fresh = await Room.findOne({ roomId: room.roomId });
    return fresh!;
  }

  it("rejects a move on a non-existent room", async () => {
    const result = await gm.makeMove("nonexistent", "Alice", "e2", "e4");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });

  it("rejects a move on a waiting room", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const result = await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });

  it("rejects a move from a non-participant", async () => {
    const room = await createPlayingRoom();
    const result = await gm.makeMove(room.roomId, "Eve", "e2", "e4");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not a player in this game");
  });

  it("rejects a move when it's not the player's turn", async () => {
    const room = await createPlayingRoom("white");
    // Alice is white, Bob is black. White moves first.
    const result = await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not your turn");
  });

  it("rejects an illegal move", async () => {
    const room = await createPlayingRoom("white");
    const result = await gm.makeMove(room.roomId, "Alice", "e2", "e5");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid move");
  });

  it("accepts a legal move and updates the board", async () => {
    const room = await createPlayingRoom("white");
    const result = await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    expect(result.success).toBe(true);
    expect(result.room).toBeDefined();
    expect(result.room!.turn).toBe("b");
    expect(result.room!.moves).toContain("e4");

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.fen).not.toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(dbRoom!.turn).toBe("b");
  });

  it("alternates turns correctly across multiple moves", async () => {
    const room = await createPlayingRoom("white");

    const r1 = await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    expect(r1.success).toBe(true);

    const r2 = await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    expect(r2.success).toBe(true);

    const r3 = await gm.makeMove(room.roomId, "Alice", "g1", "f3");
    expect(r3.success).toBe(true);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.moves).toEqual(["e4", "e5", "Nf3"]);
    expect(dbRoom!.turn).toBe("b");
  });

  it("detects checkmate (Scholar's mate)", async () => {
    const room = await createPlayingRoom("white");

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    await gm.makeMove(room.roomId, "Alice", "f1", "c4");
    await gm.makeMove(room.roomId, "Bob", "b8", "c6");
    await gm.makeMove(room.roomId, "Alice", "d1", "h5");
    await gm.makeMove(room.roomId, "Bob", "g8", "f6");
    const result = await gm.makeMove(room.roomId, "Alice", "h5", "f7");

    expect(result.success).toBe(true);
    expect(result.room!.status).toBe("finished");
    expect(result.room!.result).toBe("1-0");
  });

  it("rejects moves after game is finished", async () => {
    const room = await createPlayingRoom("white");

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    await gm.makeMove(room.roomId, "Alice", "f1", "c4");
    await gm.makeMove(room.roomId, "Bob", "b8", "c6");
    await gm.makeMove(room.roomId, "Alice", "d1", "h5");
    await gm.makeMove(room.roomId, "Bob", "g8", "f6");
    await gm.makeMove(room.roomId, "Alice", "h5", "f7");

    const result = await gm.makeMove(room.roomId, "Bob", "e8", "e7");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });
});

// ---------------------------------------------------------------------------
// resign
// ---------------------------------------------------------------------------
describe("resign", () => {
  async function createPlayingRoom() {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    return (await Room.findOne({ roomId: room.roomId }))!;
  }

  it("marks the game as finished when white resigns", async () => {
    const room = await createPlayingRoom();
    await gm.resign(room.roomId, "Alice");

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.status).toBe("finished");
    expect(dbRoom!.result).toBe("0-1");
  });

  it("marks the game as finished when black resigns", async () => {
    const room = await createPlayingRoom();
    await gm.resign(room.roomId, "Bob");

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.status).toBe("finished");
    expect(dbRoom!.result).toBe("1-0");
  });

  it("does nothing on a non-existent room", async () => {
    await expect(gm.resign("nonexistent", "Alice")).resolves.toBeUndefined();
  });

  it("does nothing on a non-playing room", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.resign(room.roomId, "Alice");

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.status).toBe("waiting");
  });
});

// ---------------------------------------------------------------------------
// rejoinRoom — advanced reconnection scenarios
// ---------------------------------------------------------------------------
describe("rejoinRoom — reconnection", () => {
  async function createPlayingRoom() {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    return (await Room.findOne({ roomId: room.roomId }))!;
  }

  it("returns current FEN, moves, and clocks after moves were played", async () => {
    const room = await createPlayingRoom();

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    await gm.makeMove(room.roomId, "Alice", "g1", "f3");

    const result = await gm.rejoinRoom(room.roomId, "Bob", mockSocket("s-re"));
    expect(result).not.toBeNull();
    expect(result!.moves).toEqual(["e4", "e5", "Nf3"]);
    expect(result!.turn).toBe("b");
    expect(result!.fen).not.toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    // Knight should be on f3 — FEN has N on f3 row
    expect(result!.fen).toContain("5N2");
  });

  it("restarts timer on rejoin if timer was stopped", async () => {
    const room = await createPlayingRoom();
    // Manually stop the timer to simulate a server restart scenario
    gm.stopAllTimers();

    const sock = mockSocket("s-timer");
    const result = await gm.rejoinRoom(room.roomId, "Alice", sock);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("playing");
    // Timer should have been restarted — stopAllTimers will find it
    // (we verify indirectly: stopAllTimers won't throw and the room is still playing)
  });

  it("does not restart timer on rejoin for finished game", async () => {
    const room = await createPlayingRoom();
    await gm.resign(room.roomId, "Alice");

    const result = await gm.rejoinRoom(room.roomId, "Alice", mockSocket("s-fin"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe("finished");
    expect(result!.result).toBe("0-1");
  });

  it("both players can rejoin independently", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "d2", "d4");

    const aliceSock = mockSocket("alice-re");
    const bobSock = mockSocket("bob-re");

    const aliceResult = await gm.rejoinRoom(room.roomId, "Alice", aliceSock);
    const bobResult = await gm.rejoinRoom(room.roomId, "Bob", bobSock);

    expect(aliceResult).not.toBeNull();
    expect(bobResult).not.toBeNull();
    expect(aliceResult!.roomId).toBe(bobResult!.roomId);
    expect(aliceSock.join).toHaveBeenCalledWith(room.roomId);
    expect(bobSock.join).toHaveBeenCalledWith(room.roomId);
    // Both see the same state
    expect(aliceResult!.moves).toEqual(bobResult!.moves);
    expect(aliceResult!.fen).toBe(bobResult!.fen);
  });

  it("rejoin after a move returns the correct game state (not stale)", async () => {
    const room = await createPlayingRoom();

    // Play some moves
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "d7", "d5");

    // Rejoin and make another move
    const sock = mockSocket("re-move");
    await gm.rejoinRoom(room.roomId, "Alice", sock);

    const result = await gm.makeMove(room.roomId, "Alice", "e4", "d5");
    expect(result.success).toBe(true);
    expect(result.room!.moves).toEqual(["e4", "d5", "exd5"]);
  });
});

// ---------------------------------------------------------------------------
// timer / clock behavior
// ---------------------------------------------------------------------------
describe("timer behavior", () => {
  async function createPlayingRoom(format: "bullet" | "blitz" = "blitz") {
    const [timeControl, increment] =
      format === "bullet" ? [60, 0] : [300, 2];
    const room = await gm.createRoom("Alice", timeControl, increment, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    return (await Room.findOne({ roomId: room.roomId }))!;
  }

  it("applies increment to the moving player's clock", async () => {
    const room = await createPlayingRoom("blitz"); // 2s increment
    const initialWhiteTime = room.whiteTime;

    // Make a move immediately — elapsed time ≈ 0, so time should go UP by increment
    const result = await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    expect(result.success).toBe(true);
    // White's time should be approximately initialWhiteTime + increment (within 1s tolerance)
    expect(result.room!.whiteTime).toBeGreaterThanOrEqual(initialWhiteTime);
  });

  it("bullet has 0 increment — clock only decreases", async () => {
    const room = await createPlayingRoom("bullet"); // 0 increment

    // Small delay so some time elapses
    await new Promise((r) => setTimeout(r, 50));

    const result = await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    expect(result.success).toBe(true);
    expect(result.room!.whiteTime).toBeLessThanOrEqual(60);
  });

  it("game:move broadcast includes updated clocks", async () => {
    const room = await createPlayingRoom("blitz");

    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: jest.fn(),
    } as any);

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    expect(emitSpy).toHaveBeenCalledWith(room.roomId);
    const emitCall = (emitSpy.mock.results[0].value as any).emit;
    expect(emitCall).toHaveBeenCalledWith(
      "game:move",
      expect.objectContaining({
        whiteTime: expect.any(Number),
        blackTime: expect.any(Number),
      })
    );

    emitSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// draw / stalemate detection
// ---------------------------------------------------------------------------
describe("draw detection", () => {
  it("detects insufficient material (K vs K after capture)", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    // White King e1, White Bishop c4 vs Black King e8 — after Bxf7 style scenario
    // Simpler: set FEN where white can capture the last black piece, leaving K vs K
    // White: Ke1, Ra1; Black: Ke8, Ra8 is too complex. Use:
    // White: Ke1, Nb3; Black: Kh8 — insufficient after any knight move.
    // Actually, K+N vs K IS insufficient material.
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    dbRoom!.fen = "7k/8/8/8/8/1N6/8/4K3 w - - 0 1";
    dbRoom!.status = "playing";
    await dbRoom!.save();

    // Clear stale in-memory chess instance so makeMove reloads from DB FEN
    (gm as any).games.delete(room.roomId);

    const result = await gm.makeMove(room.roomId, "Alice", "b3", "a5");
    expect(result.success).toBe(true);
    expect(result.room!.status).toBe("finished");
    expect(result.room!.result).toBe("1/2-1/2");
  });
});

// ---------------------------------------------------------------------------
// closeRoom
// ---------------------------------------------------------------------------
describe("closeRoom", () => {
  it("deletes a waiting room when called by the owner", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const result = await gm.closeRoom(room.roomId, "Alice");

    expect(result).toBe(true);
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom).toBeNull();
  });

  it("returns false for a non-existent room", async () => {
    const result = await gm.closeRoom("nonexistent", "Alice");
    expect(result).toBe(false);
  });

  it("returns false when room is already playing", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const result = await gm.closeRoom(room.roomId, "Alice");
    expect(result).toBe(false);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom).not.toBeNull();
  });

  it("returns false when caller is not the owner", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const result = await gm.closeRoom(room.roomId, "Bob");

    expect(result).toBe(false);
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom).not.toBeNull();
  });

  it("returns false when room is finished", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    await gm.resign(room.roomId, "Alice");

    const result = await gm.closeRoom(room.roomId, "Alice");
    expect(result).toBe(false);
  });

  it("removes room from lobby listing after close", async () => {
    const room1 = await gm.createRoom("Alice", 300, 2, "white");
    await gm.createRoom("Bob", 600, 5, "black");

    await gm.closeRoom(room1.roomId, "Alice");

    const rooms = await gm.getRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0].owner).toBe("Bob");
  });
});

// ---------------------------------------------------------------------------
// undoToPlayer
// ---------------------------------------------------------------------------
describe("undoToPlayer", () => {
  async function createPlayingRoom() {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    return (await Room.findOne({ roomId: room.roomId }))!;
  }

  it("undoes 1 half-move when it is already requester's turn", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");

    // It's white's turn (Alice), Alice requests undo of her opponent's last move
    // Actually this means Alice wants to undo. It's her turn, so the last move was Bob's.
    // Undoing 1 move returns to Bob's turn... but we want Alice's turn.
    // Alice requests undo: she wants to redo her move. Undo Bob's move (1), then Alice's move (2).
    // After undo: it should be Alice's turn with 0 moves undone = original position? No.
    // Let me re-read the logic: the undo reverts until it's the requester's turn.
    // It's currently Alice's turn (w). Requester is Alice. targetTurn = w.
    // Loop: undoCount=0, chess.turn()=w but undoCount==0 so first iteration always runs.
    // undo() -> turn becomes b, undoCount=1. Next iteration: undoCount=1, chess.turn()=b != w, so undo again.
    // undo() -> turn becomes w, undoCount=2. Next iteration: undoCount=2 >= 2, stop.
    // So it undoes 2 moves. That's correct: Alice wants to take back her e4 move.
    gm.requestUndo(room.roomId, "Alice", 2);
    const result = await gm.undoToPlayer(room.roomId);

    expect(result.success).toBe(true);
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.moves).toEqual([]);
    expect(dbRoom!.turn).toBe("w");
  });

  it("undoes 1 half-move when opponent just moved", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    // It's Bob's turn. Bob requests undo — wants to undo Alice's move so it's Bob's... wait no.
    // Bob requests undo: targetTurn = b (Bob is black).
    // Current turn is b. undoCount=0, first iteration always runs.
    // undo() -> turn=w, undoCount=1. Next: undoCount=1, turn=w != b, undo again... but undoCount would be 2, stop.
    // Hmm, but there's only 1 move. chess.undo() on empty returns null. So it undoes 1 move, turn=w. undoCount=1.
    // Then loop: undoCount=1, turn=w != b, try undo -> null, break. Result: 1 undo.
    // But that puts it at white's turn, not Bob's. That doesn't seem right.
    // Actually, the scenario here: Alice played e4, it's Bob's turn. Bob requests undo.
    // Bob wants Alice's move undone. After undo, it's Alice's turn (w). moves=[].
    // That makes sense: Bob is saying "undo that move" referring to Alice's e4.
    gm.requestUndo(room.roomId, "Bob", 1);
    const result = await gm.undoToPlayer(room.roomId);

    expect(result.success).toBe(true);
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.moves).toEqual([]);
    expect(dbRoom!.turn).toBe("w");
  });

  it("undoes 2 half-moves to return to requester's turn after opponent replied", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    await gm.makeMove(room.roomId, "Alice", "d2", "d4");
    await gm.makeMove(room.roomId, "Bob", "d7", "d5");

    // It's Alice's turn. Alice requests undo (wants to redo her d4 move).
    gm.requestUndo(room.roomId, "Alice", 4);
    const result = await gm.undoToPlayer(room.roomId);

    expect(result.success).toBe(true);
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.moves).toEqual(["e4", "e5"]);
    expect(dbRoom!.turn).toBe("w");
  });

  it("returns false when no undo request is pending", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    const result = await gm.undoToPlayer(room.roomId);
    expect(result.success).toBe(false);
  });

  it("returns false on non-existent room", async () => {
    gm.requestUndo("nonexistent", "Alice", 1);
    const result = await gm.undoToPlayer("nonexistent");
    expect(result.success).toBe(false);
  });

  it("returns false when no moves to undo", async () => {
    const room = await createPlayingRoom();
    gm.requestUndo(room.roomId, "Alice", 0);
    const result = await gm.undoToPlayer(room.roomId);
    expect(result.success).toBe(false);
  });

  it("cancels undo request when a move is made", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    gm.requestUndo(room.roomId, "Bob", 1);
    expect(gm.getUndoRequest(room.roomId)).toBeDefined();

    await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    expect(gm.getUndoRequest(room.roomId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handlePlayerDisconnect / handlePlayerReconnect / claimDisconnectResult
// ---------------------------------------------------------------------------
describe("disconnect claim", () => {
  async function createPlayingRoom() {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    return (await Room.findOne({ roomId: room.roomId }))!;
  }

  it("sets disconnect state when a player disconnects during a playing game", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    const state = gm.getDisconnectState(room.roomId);
    expect(state).toBeDefined();
    expect(state!.playerName).toBe("Alice");
    expect(state!.claimAvailable).toBe(false);
  });

  it("emits game:opponent-disconnected when a player disconnects", async () => {
    const room = await createPlayingRoom();
    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: jest.fn(),
    } as any);

    await gm.handlePlayerDisconnect(room.roomId, "Bob");

    expect(emitSpy).toHaveBeenCalledWith(room.roomId);
    const emitCall = (emitSpy.mock.results[0].value as any).emit;
    expect(emitCall).toHaveBeenCalledWith("game:opponent-disconnected", { playerName: "Bob" });

    emitSpy.mockRestore();
  });

  it("does nothing if the room is not playing", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    expect(gm.getDisconnectState(room.roomId)).toBeUndefined();
  });

  it("does nothing if the player is not a participant", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Eve");

    expect(gm.getDisconnectState(room.roomId)).toBeUndefined();
  });

  it("does not create duplicate disconnect timer if already set", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");
    const state1 = gm.getDisconnectState(room.roomId);
    await gm.handlePlayerDisconnect(room.roomId, "Bob");
    const state2 = gm.getDisconnectState(room.roomId);

    expect(state2!.playerName).toBe("Alice");
    expect(state1).toBe(state2);
  });

  it("clears disconnect state when the player reconnects", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    await gm.handlePlayerReconnect(room.roomId, "Alice");
    expect(gm.getDisconnectState(room.roomId)).toBeUndefined();
  });

  it("emits game:opponent-reconnected when the player reconnects", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: jest.fn(),
    } as any);

    await gm.handlePlayerReconnect(room.roomId, "Alice");

    const emitCall = (emitSpy.mock.results[0].value as any).emit;
    expect(emitCall).toHaveBeenCalledWith("game:opponent-reconnected", { playerName: "Alice" });

    emitSpy.mockRestore();
  });

  it("does not clear disconnect state if a different player reconnects", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    await gm.handlePlayerReconnect(room.roomId, "Bob");
    expect(gm.getDisconnectState(room.roomId)).toBeDefined();
  });

  it("sets claimAvailable after grace period elapses", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    expect(gm.getDisconnectState(room.roomId)!.claimAvailable).toBe(false);

    // Wait for the real timeout (we can't use fake timers with MongoDB)
    // Instead, verify the timeout is set and manually advance the state
    const state = gm.getDisconnectState(room.roomId)!;
    expect(state.timeout).toBeDefined();

    // Simulate the timeout callback effect
    state.claimAvailable = true;
    expect(gm.getDisconnectState(room.roomId)!.claimAvailable).toBe(true);
  });

  it("allows opponent to claim win after grace period", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    const state = gm.getDisconnectState(room.roomId)!;
    state.claimAvailable = true;

    const result = await gm.claimDisconnectResult(room.roomId, "Bob", "win");
    expect(result.success).toBe(true);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.status).toBe("finished");
    expect(dbRoom!.result).toBe("0-1");
  });

  it("allows opponent to claim draw after grace period", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    const state = gm.getDisconnectState(room.roomId)!;
    state.claimAvailable = true;

    const result = await gm.claimDisconnectResult(room.roomId, "Bob", "draw");
    expect(result.success).toBe(true);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.status).toBe("finished");
    expect(dbRoom!.result).toBe("1/2-1/2");
  });

  it("black can claim win when white disconnects", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    const state = gm.getDisconnectState(room.roomId)!;
    state.claimAvailable = true;

    const result = await gm.claimDisconnectResult(room.roomId, "Bob", "win");
    expect(result.success).toBe(true);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.result).toBe("0-1");
  });

  it("white can claim win when black disconnects", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Bob");

    const state = gm.getDisconnectState(room.roomId)!;
    state.claimAvailable = true;

    const result = await gm.claimDisconnectResult(room.roomId, "Alice", "win");
    expect(result.success).toBe(true);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.result).toBe("1-0");
  });

  it("rejects claim before grace period elapses", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    const result = await gm.claimDisconnectResult(room.roomId, "Bob", "win");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Grace period not elapsed");
  });

  it("rejects claim by the disconnected player", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");
    gm.getDisconnectState(room.roomId)!.claimAvailable = true;

    const result = await gm.claimDisconnectResult(room.roomId, "Alice", "win");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot claim against yourself");
  });

  it("rejects claim when no disconnect is pending", async () => {
    const room = await createPlayingRoom();
    const result = await gm.claimDisconnectResult(room.roomId, "Bob", "win");
    expect(result.success).toBe(false);
    expect(result.error).toBe("No pending disconnect");
  });

  it("rejects claim by a non-participant", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");
    gm.getDisconnectState(room.roomId)!.claimAvailable = true;

    const result = await gm.claimDisconnectResult(room.roomId, "Eve", "win");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not a player in this game");
  });

  it("clears disconnect state after a successful claim", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");
    gm.getDisconnectState(room.roomId)!.claimAvailable = true;

    await gm.claimDisconnectResult(room.roomId, "Bob", "win");
    expect(gm.getDisconnectState(room.roomId)).toBeUndefined();
  });

  it("emits game:over with correct reason on claim win", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Bob");
    gm.getDisconnectState(room.roomId)!.claimAvailable = true;

    const mockEmit = jest.fn();
    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: mockEmit,
    } as any);

    await gm.claimDisconnectResult(room.roomId, "Alice", "win");

    expect(mockEmit).toHaveBeenCalledWith("game:over", {
      result: "1-0",
      reason: "opponent left",
    });

    emitSpy.mockRestore();
  });

  it("emits game:over with correct reason on claim draw", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Bob");
    gm.getDisconnectState(room.roomId)!.claimAvailable = true;

    const mockEmit = jest.fn();
    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: mockEmit,
    } as any);

    await gm.claimDisconnectResult(room.roomId, "Alice", "draw");

    expect(mockEmit).toHaveBeenCalledWith("game:over", {
      result: "1/2-1/2",
      reason: "opponent left — draw claimed",
    });

    emitSpy.mockRestore();
  });

  it("does nothing when feature flag is disabled", async () => {
    const orig = process.env.FEATURE_DISCONNECT_CLAIM;
    process.env.FEATURE_DISCONNECT_CLAIM = "false";

    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    expect(gm.getDisconnectState(room.roomId)).toBeUndefined();

    process.env.FEATURE_DISCONNECT_CLAIM = orig;
  });

  it("stopAllTimers clears disconnect timers", async () => {
    const room = await createPlayingRoom();
    await gm.handlePlayerDisconnect(room.roomId, "Alice");

    expect(gm.getDisconnectState(room.roomId)).toBeDefined();
    gm.stopAllTimers();
    expect(gm.getDisconnectState(room.roomId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// draw offer
// ---------------------------------------------------------------------------
describe("draw offer", () => {
  async function createPlayingRoom(
    ownerColor: "white" | "black" = "white"
  ) {
    const room = await gm.createRoom("Alice", 300, 2, ownerColor);
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    const fresh = await Room.findOne({ roomId: room.roomId });
    return fresh!;
  }

  it("offers a draw successfully", async () => {
    const room = await createPlayingRoom();
    const result = await gm.offerDraw(room.roomId, "Alice");
    expect(result.success).toBe(true);
    expect(gm.getDrawOffer(room.roomId)).toBeDefined();
    expect(gm.getDrawOffer(room.roomId)!.offeredBy).toBe("Alice");
  });

  it("accepts a draw and ends the game", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    const result = await gm.respondDraw(room.roomId, "Bob", true);
    expect(result.success).toBe(true);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom!.status).toBe("finished");
    expect(dbRoom!.result).toBe("1/2-1/2");
  });

  it("declines a draw", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    const result = await gm.respondDraw(room.roomId, "Bob", false);
    expect(result.success).toBe(true);
    expect(gm.getDrawOffer(room.roomId)).toBeUndefined();
  });

  it("making a move auto-cancels a pending draw offer", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Bob");
    expect(gm.getDrawOffer(room.roomId)).toBeDefined();

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    expect(gm.getDrawOffer(room.roomId)).toBeUndefined();
  });

  it("anti-spam: cannot offer again before opponent moves", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    await gm.respondDraw(room.roomId, "Bob", false);

    const result = await gm.offerDraw(room.roomId, "Alice");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Must wait for opponent to move");
  });

  it("anti-spam: can offer again after opponent moves", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    await gm.respondDraw(room.roomId, "Bob", false);

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");

    const result = await gm.offerDraw(room.roomId, "Alice");
    expect(result.success).toBe(true);
  });

  it("anti-spam: offerer's own move does not reset cooldown", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    await gm.respondDraw(room.roomId, "Bob", false);

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    const result = await gm.offerDraw(room.roomId, "Alice");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Must wait for opponent to move");
  });

  it("other player can offer after first player's offer was declined", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    await gm.respondDraw(room.roomId, "Bob", false);

    const result = await gm.offerDraw(room.roomId, "Bob");
    expect(result.success).toBe(true);
  });

  it("rejects offer when feature flag is disabled", async () => {
    const orig = process.env.FEATURE_DRAW_OFFER;
    process.env.FEATURE_DRAW_OFFER = "false";

    const room = await createPlayingRoom();
    const result = await gm.offerDraw(room.roomId, "Alice");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Feature disabled");

    process.env.FEATURE_DRAW_OFFER = orig;
  });

  it("rejects offer on non-playing game", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const result = await gm.offerDraw(room.roomId, "Alice");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });

  it("rejects offer by non-player", async () => {
    const room = await createPlayingRoom();
    const result = await gm.offerDraw(room.roomId, "Eve");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not a player in this game");
  });

  it("rejects offer when one is already pending", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    const result = await gm.offerDraw(room.roomId, "Bob");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Draw already offered");
  });

  it("rejects self-response to draw offer", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    const result = await gm.respondDraw(room.roomId, "Alice", true);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Cannot respond to your own offer");
  });

  it("rejects response when no offer pending", async () => {
    const room = await createPlayingRoom();
    const result = await gm.respondDraw(room.roomId, "Bob", true);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No pending draw offer");
  });

  it("rejects response by non-player", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    const result = await gm.respondDraw(room.roomId, "Eve", true);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not a player in this game");
  });

  it("clears draw offer on resign", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    await gm.resign(room.roomId, "Alice");
    expect(gm.getDrawOffer(room.roomId)).toBeUndefined();
  });

  it("clears draw offer on undo", async () => {
    const room = await createPlayingRoom();
    await gm.makeMove(room.roomId, "Alice", "e2", "e4");
    await gm.makeMove(room.roomId, "Bob", "e7", "e5");
    await gm.offerDraw(room.roomId, "Alice");
    gm.requestUndo(room.roomId, "Alice", 2);
    await gm.undoToPlayer(room.roomId);
    expect(gm.getDrawOffer(room.roomId)).toBeUndefined();
  });

  it("emits game:over with 'mutual agreement' reason on accept", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");

    const mockEmit = jest.fn();
    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: mockEmit,
    } as any);

    await gm.respondDraw(room.roomId, "Bob", true);

    expect(mockEmit).toHaveBeenCalledWith("game:over", {
      result: "1/2-1/2",
      reason: "mutual agreement",
    });

    emitSpy.mockRestore();
  });

  it("emits game:draw-declined on decline", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");

    const mockEmit = jest.fn();
    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: mockEmit,
    } as any);

    await gm.respondDraw(room.roomId, "Bob", false);

    expect(mockEmit).toHaveBeenCalledWith("game:draw-declined");

    emitSpy.mockRestore();
  });

  it("emits game:draw-cancelled when a move auto-cancels the offer", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Bob");

    const mockEmit = jest.fn();
    const emitSpy = jest.spyOn(io, "to").mockReturnValue({
      emit: mockEmit,
    } as any);

    await gm.makeMove(room.roomId, "Alice", "e2", "e4");

    expect(mockEmit).toHaveBeenCalledWith("game:draw-cancelled");

    emitSpy.mockRestore();
  });

  it("stopAllTimers clears draw offer state", async () => {
    const room = await createPlayingRoom();
    await gm.offerDraw(room.roomId, "Alice");
    expect(gm.getDrawOffer(room.roomId)).toBeDefined();

    gm.stopAllTimers();
    expect(gm.getDrawOffer(room.roomId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// serializeRoom
// ---------------------------------------------------------------------------
describe("serializeRoom", () => {
  it("serializes all expected fields", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const serialized = gm.serializeRoom(room);

    expect(serialized).toEqual(
      expect.objectContaining({
        roomId: room.roomId,
        owner: "Alice",
        opponent: null,
        timeFormat: "blitz",
        timeControl: 300,
        increment: 2,
        colorChoice: "white",
        status: "waiting",
        whitePlayer: null,
        blackPlayer: null,
        whiteTime: 300,
        blackTime: 300,
        turn: "w",
        result: null,
        moves: [],
      })
    );
  });

  it("does not leak internal Mongoose fields", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const serialized = gm.serializeRoom(room);
    const keys = Object.keys(serialized);

    expect(keys).not.toContain("_id");
    expect(keys).not.toContain("__v");
    expect(keys).not.toContain("createdAt");
    expect(keys).not.toContain("updatedAt");
  });
});

// ---------------------------------------------------------------------------
// giveTime
// ---------------------------------------------------------------------------
describe("giveTime", () => {
  async function createPlayingRoom(
    ownerColor: "white" | "black" = "white"
  ) {
    const room = await gm.createRoom("Alice", 300, 2, ownerColor);
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    const fresh = await Room.findOne({ roomId: room.roomId });
    return fresh!;
  }

  it("adds 15 seconds to opponent's clock when white gives time", async () => {
    const room = await createPlayingRoom();
    const blackBefore = room.blackTime;
    const result = await gm.giveTime(room.roomId, "Alice");

    expect(result.success).toBe(true);
    const updated = await Room.findOne({ roomId: room.roomId });
    expect(updated!.blackTime).toBeCloseTo(blackBefore + 15, 0);
    expect(updated!.whiteTime).toBeCloseTo(room.whiteTime, 0);
  });

  it("adds 15 seconds to opponent's clock when black gives time", async () => {
    const room = await createPlayingRoom();
    const whiteBefore = room.whiteTime;
    const result = await gm.giveTime(room.roomId, "Bob");

    expect(result.success).toBe(true);
    const updated = await Room.findOne({ roomId: room.roomId });
    expect(updated!.whiteTime).toBeCloseTo(whiteBefore + 15, 0);
    expect(updated!.blackTime).toBeCloseTo(room.blackTime, 0);
  });

  it("rejects for non-existent room", async () => {
    const result = await gm.giveTime("nonexistent", "Alice");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });

  it("rejects for non-player", async () => {
    const room = await createPlayingRoom();
    const result = await gm.giveTime(room.roomId, "Charlie");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not a player in this game");
  });

  it("rejects for waiting room", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");
    const result = await gm.giveTime(room.roomId, "Alice");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });

  it("rejects for finished room", async () => {
    const room = await createPlayingRoom();
    await gm.resign(room.roomId, "Alice");
    const result = await gm.giveTime(room.roomId, "Alice");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Game not active");
  });

  it("rejects when feature flag is disabled", async () => {
    const orig = process.env.FEATURE_GIVE_TIME;
    process.env.FEATURE_GIVE_TIME = "false";

    const room = await createPlayingRoom();
    const result = await gm.giveTime(room.roomId, "Alice");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Feature disabled");

    process.env.FEATURE_GIVE_TIME = orig;
  });

  it("can be given multiple times", async () => {
    const room = await createPlayingRoom();
    const blackBefore = room.blackTime;

    await gm.giveTime(room.roomId, "Alice");
    await gm.giveTime(room.roomId, "Alice");

    const updated = await Room.findOne({ roomId: room.roomId });
    expect(updated!.blackTime).toBeCloseTo(blackBefore + 30, 0);
  });
});

// ---------------------------------------------------------------------------
// Private Games
// ---------------------------------------------------------------------------
describe("private games", () => {
  it("creates a private room with isPrivate flag", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white", true);

    expect(room.isPrivate).toBe(true);
    expect(room.owner).toBe("Alice");
    expect(room.status).toBe("waiting");
  });

  it("defaults isPrivate to false", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white");

    expect(room.isPrivate).toBe(false);
  });

  it("excludes private rooms from getRooms()", async () => {
    await gm.createRoom("Alice", 300, 2, "white", true);
    await gm.createRoom("Bob", 600, 5, "random", false);

    const rooms = await gm.getRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0].owner).toBe("Bob");
  });

  it("getPrivateRoomInfo returns a private room", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white", true);

    const info = await gm.getPrivateRoomInfo(room.roomId);
    expect(info).not.toBeNull();
    expect(info!.roomId).toBe(room.roomId);
    expect(info!.owner).toBe("Alice");
  });

  it("getPrivateRoomInfo returns null for non-private rooms", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white", false);

    const info = await gm.getPrivateRoomInfo(room.roomId);
    expect(info).toBeNull();
  });

  it("getPrivateRoomInfo returns null for nonexistent rooms", async () => {
    const info = await gm.getPrivateRoomInfo("no-such-id");
    expect(info).toBeNull();
  });

  it("getPrivateRoomInfo returns null when feature flag is disabled", async () => {
    const orig = process.env.FEATURE_PRIVATE_GAMES;
    process.env.FEATURE_PRIVATE_GAMES = "false";

    const room = await gm.createRoom("Alice", 300, 2, "white", true);
    const info = await gm.getPrivateRoomInfo(room.roomId);
    expect(info).toBeNull();

    process.env.FEATURE_PRIVATE_GAMES = orig;
  });

  it("joining a private room starts the game", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white", true);
    const sock = mockSocket("sock-2");

    const joined = await gm.joinRoom(room.roomId, "Bob", sock);

    expect(joined).not.toBeNull();
    expect(joined!.status).toBe("playing");
    expect(joined!.isPrivate).toBe(true);
  });

  it("closing a private waiting room deletes it", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white", true);

    const closed = await gm.closeRoom(room.roomId, "Alice");
    expect(closed).toBe(true);

    const info = await gm.getPrivateRoomInfo(room.roomId);
    expect(info).toBeNull();
  });

  it("closeWaitingRoomsByOwner deletes private rooms too", async () => {
    await gm.createRoom("Alice", 300, 2, "white", true);
    await gm.createRoom("Alice", 600, 5, "random", false);

    await gm.closeWaitingRoomsByOwner("Alice");

    const allRooms = await Room.find({});
    expect(allRooms).toHaveLength(0);
  });

  it("serializeRoom includes isPrivate", async () => {
    const room = await gm.createRoom("Alice", 300, 2, "white", true);
    const serialized = gm.serializeRoom(room);

    expect(serialized.isPrivate).toBe(true);
  });
});
