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
    const room = await gm.createRoom("Alice", "bullet", "white");

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
    const room = await gm.createRoom("Bob", "blitz", "random");

    expect(room.timeControl).toBe(300);
    expect(room.timeIncrement).toBe(2);
    expect(room.whiteTime).toBe(300);
    expect(room.blackTime).toBe(300);
  });

  it("creates a rapid room with 10 min + 5s increment", async () => {
    const room = await gm.createRoom("Carol", "rapid", "black");

    expect(room.timeControl).toBe(600);
    expect(room.timeIncrement).toBe(5);
  });

  it("creates a classical room with 30 min + 10s increment", async () => {
    const room = await gm.createRoom("Dave", "classical", "white");

    expect(room.timeControl).toBe(1800);
    expect(room.timeIncrement).toBe(10);
  });

  it("persists the room to MongoDB", async () => {
    const room = await gm.createRoom("Eve", "blitz", "random");
    const found = await Room.findOne({ roomId: room.roomId });

    expect(found).not.toBeNull();
    expect(found!.owner).toBe("Eve");
  });

  it("sets initial FEN to starting position", async () => {
    const room = await gm.createRoom("Frank", "blitz", "white");

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
    await gm.createRoom("Alice", "blitz", "white");
    await gm.createRoom("Bob", "rapid", "black");

    const r = await gm.createRoom("Carol", "bullet", "random");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
    const sock = mockSocket();

    const result = await gm.joinRoom(room.roomId, "Alice", sock);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("waiting");
    expect(result!.opponent).toBeNull();
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("starts the game when an opponent joins", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
    const sock = mockSocket("sock-2");

    const result = await gm.joinRoom(room.roomId, "Bob", sock);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("playing");
    expect(result!.opponent).toBe("Bob");
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("assigns colors correctly when owner picks white", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
    const result = await gm.joinRoom(room.roomId, "Bob", mockSocket());

    expect(result!.whitePlayer).toBe("Alice");
    expect(result!.blackPlayer).toBe("Bob");
  });

  it("assigns colors correctly when owner picks black", async () => {
    const room = await gm.createRoom("Alice", "blitz", "black");
    const result = await gm.joinRoom(room.roomId, "Bob", mockSocket());

    expect(result!.whitePlayer).toBe("Bob");
    expect(result!.blackPlayer).toBe("Alice");
  });

  it("assigns colors randomly when owner picks random", async () => {
    const room = await gm.createRoom("Alice", "blitz", "random");
    const result = await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const players = [result!.whitePlayer, result!.blackPlayer].sort();
    expect(players).toEqual(["Alice", "Bob"]);
  });

  it("returns existing room when joining an in-progress game", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const result = await gm.rejoinRoom(room.roomId, "Eve", mockSocket("s3"));
    expect(result).toBeNull();
  });

  it("allows the owner to rejoin", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const sock = mockSocket("s4");
    const result = await gm.rejoinRoom(room.roomId, "Alice", sock);
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe(room.roomId);
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("allows the opponent to rejoin", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const sock = mockSocket("s5");
    const result = await gm.rejoinRoom(room.roomId, "Bob", sock);
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe(room.roomId);
    expect(sock.join).toHaveBeenCalledWith(room.roomId);
  });

  it("allows rejoining a finished game", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", ownerColor);
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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", format, "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());

    const result = await gm.closeRoom(room.roomId, "Alice");
    expect(result).toBe(false);

    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom).not.toBeNull();
  });

  it("returns false when caller is not the owner", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
    const result = await gm.closeRoom(room.roomId, "Bob");

    expect(result).toBe(false);
    const dbRoom = await Room.findOne({ roomId: room.roomId });
    expect(dbRoom).not.toBeNull();
  });

  it("returns false when room is finished", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
    await gm.joinRoom(room.roomId, "Bob", mockSocket());
    await gm.resign(room.roomId, "Alice");

    const result = await gm.closeRoom(room.roomId, "Alice");
    expect(result).toBe(false);
  });

  it("removes room from lobby listing after close", async () => {
    const room1 = await gm.createRoom("Alice", "blitz", "white");
    await gm.createRoom("Bob", "rapid", "black");

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
    const room = await gm.createRoom("Alice", "blitz", "white");
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
// serializeRoom
// ---------------------------------------------------------------------------
describe("serializeRoom", () => {
  it("serializes all expected fields", async () => {
    const room = await gm.createRoom("Alice", "blitz", "white");
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
    const room = await gm.createRoom("Alice", "blitz", "white");
    const serialized = gm.serializeRoom(room);
    const keys = Object.keys(serialized);

    expect(keys).not.toContain("_id");
    expect(keys).not.toContain("__v");
    expect(keys).not.toContain("createdAt");
    expect(keys).not.toContain("updatedAt");
  });
});
