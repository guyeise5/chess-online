import express from "express";
import http from "http";
import request from "supertest";
import { Server } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { AddressInfo } from "net";
import { GameManager } from "../game/GameManager";
import { registerSocketHandlers } from "../socket/handlers";
import { getSessionUserId } from "../auth/samlAuth";
import UserPreferences from "../models/UserPreferences";
import Game from "../models/Game";
import { setupDB, teardownDB, clearDB } from "./setup";

beforeAll(setupDB);
afterAll(teardownDB);
afterEach(clearDB);

// ---------------------------------------------------------------------------
// getSessionUserId helper
// ---------------------------------------------------------------------------
describe("getSessionUserId", () => {
  it("returns userId from req.user", () => {
    const req = { user: { userId: "u1", displayName: "User 1" } };
    expect(getSessionUserId(req)).toBe("u1");
  });

  it("returns undefined when req.user is missing", () => {
    expect(getSessionUserId({})).toBeUndefined();
    expect(getSessionUserId({ user: undefined })).toBeUndefined();
  });

  it("returns undefined when userId is not a string", () => {
    expect(getSessionUserId({ user: { userId: 123 } })).toBeUndefined();
    expect(getSessionUserId({ user: { userId: "" } })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// API route authorization (simulated SAML-enabled server)
// ---------------------------------------------------------------------------
describe("API authorization when SAML enabled", () => {
  let app: express.Application;

  function mockAuth(userId: string): express.RequestHandler {
    return (req, _res, next) => {
      (req as any).user = { userId, displayName: userId };
      next();
    };
  }

  beforeAll(() => {
    app = express();
    app.use(express.json());
  });

  describe("GET /api/preferences/:userId", () => {
    const ROUTE = "/api/preferences";

    beforeAll(() => {
      app.get(`${ROUTE}/:userId`, mockAuth("user-a"), async (req, res) => {
        const { userId } = req.params;
        if (!userId || typeof userId !== "string") {
          res.status(400).json({ error: "userId is required" });
          return;
        }
        const sessionUid = getSessionUserId(req);
        if (!sessionUid || sessionUid !== userId) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        const doc = await UserPreferences.findOne({ userId }).lean();
        if (!doc) {
          res.status(404).json({ error: "Preferences not found" });
          return;
        }
        res.json({ boardTheme: doc.boardTheme });
      });
    });

    it("returns 403 when session user does not match URL param", async () => {
      await UserPreferences.create({ userId: "user-b" });
      const res = await request(app).get(`${ROUTE}/user-b`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("passes through when session user matches", async () => {
      await UserPreferences.create({ userId: "user-a" });
      const res = await request(app).get(`${ROUTE}/user-a`);
      expect(res.status).toBe(200);
      expect(res.body.boardTheme).toBe("brown");
    });
  });

  describe("PUT /api/preferences/:userId", () => {
    const ROUTE = "/put-prefs";

    beforeAll(() => {
      app.put(`${ROUTE}/:userId`, mockAuth("user-a"), async (req, res) => {
        const { userId } = req.params;
        const sessionUid = getSessionUserId(req);
        if (!sessionUid || sessionUid !== userId) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        await UserPreferences.findOneAndUpdate(
          { userId },
          { $set: { boardTheme: req.body.boardTheme } },
          { upsert: true, new: true }
        );
        res.json({ ok: true });
      });
    });

    it("returns 403 when session user does not match URL param", async () => {
      const res = await request(app)
        .put(`${ROUTE}/user-b`)
        .send({ boardTheme: "blue" });
      expect(res.status).toBe(403);
    });

    it("passes through when session user matches", async () => {
      const res = await request(app)
        .put(`${ROUTE}/user-a`)
        .send({ boardTheme: "green" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe("GET /api/games (game history)", () => {
    const ROUTE = "/api-games-list";

    beforeAll(() => {
      app.get(ROUTE, mockAuth("user-a"), async (req, res) => {
        const playerParam = Array.isArray(req.query["player"])
          ? req.query["player"][0]
          : req.query["player"];
        const player = typeof playerParam === "string" ? playerParam : "";
        if (!player) {
          res.status(400).json({ error: "player query parameter is required" });
          return;
        }
        const sessionUid = getSessionUserId(req);
        if (!sessionUid || sessionUid !== player) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        res.json([]);
      });
    });

    it("returns 403 when player param does not match session", async () => {
      const res = await request(app).get(`${ROUTE}?player=user-b`);
      expect(res.status).toBe(403);
    });

    it("passes through when player param matches session", async () => {
      const res = await request(app).get(`${ROUTE}?player=user-a`);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/games/:gameId", () => {
    const ROUTE = "/api-games-save";

    beforeAll(() => {
      app.post(`${ROUTE}/:gameId`, mockAuth("user-a"), async (req, res) => {
        const sessionUid = getSessionUserId(req);
        const pw =
          typeof req.body.playerWhite === "string" ? req.body.playerWhite : "";
        const pb =
          typeof req.body.playerBlack === "string" ? req.body.playerBlack : "";
        if (!sessionUid || (sessionUid !== pw && sessionUid !== pb)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        res.json({ ok: true });
      });
    });

    it("returns 403 when session user is neither playerWhite nor playerBlack", async () => {
      const res = await request(app)
        .post(`${ROUTE}/game-1`)
        .send({ playerWhite: "user-x", playerBlack: "user-y" });
      expect(res.status).toBe(403);
    });

    it("passes through when session user is playerWhite", async () => {
      const res = await request(app)
        .post(`${ROUTE}/game-2`)
        .send({ playerWhite: "user-a", playerBlack: "user-b" });
      expect(res.status).toBe(200);
    });

    it("passes through when session user is playerBlack", async () => {
      const res = await request(app)
        .post(`${ROUTE}/game-3`)
        .send({ playerWhite: "user-b", playerBlack: "user-a" });
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Socket identity enforcement (samlEnabled = true)
// ---------------------------------------------------------------------------
describe("Socket identity enforcement when samlEnabled", () => {
  let httpServer: http.Server;
  let io: Server;
  let gm: GameManager;
  let port: number;

  function connectClient(): ClientSocket {
    return ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    });
  }

  function waitForConnect(client: ClientSocket): Promise<void> {
    return new Promise((resolve) => {
      client.once("connect", resolve);
    });
  }

  function emitWithAck<T = Record<string, unknown>>(
    client: ClientSocket,
    event: string,
    data: Record<string, unknown>
  ): Promise<T> {
    return new Promise((resolve) => {
      client.emit(event, data, (res: T) => resolve(res));
    });
  }

  beforeAll(async () => {
    httpServer = http.createServer();
    io = new Server(httpServer);
    gm = new GameManager(io);

    registerSocketHandlers(io, gm, true);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    gm.stopAllTimers();
    io.disconnectSockets(true);
    await new Promise((r) => setTimeout(r, 50));
    await clearDB();
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  it("rejects room:create when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "room:create", {
      userId: "attacker",
      timeControl: 300,
      increment: 0,
      colorChoice: "random",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects room:join when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "room:join", {
      roomId: "some-room",
      userId: "attacker",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects room:rejoin when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "room:rejoin", {
      roomId: "some-room",
      userId: "attacker",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects game:move when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "game:move", {
      roomId: "r1",
      userId: "attacker",
      from: "e2",
      to: "e4",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects game:chat when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "game:chat", {
      roomId: "r1",
      userId: "attacker",
      text: "hello",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects game:give-time when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "game:give-time", {
      roomId: "r1",
      userId: "attacker",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects game:draw-offer when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "game:draw-offer", {
      roomId: "r1",
      userId: "attacker",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects game:claim-disconnect-win when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "game:claim-disconnect-win", {
      roomId: "r1",
      userId: "attacker",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });

  it("rejects game:claim-disconnect-draw when no session identity is present", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "game:claim-disconnect-draw", {
      roomId: "r1",
      userId: "attacker",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: false, error: "Unauthorized" })
    );

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Socket handlers still work normally when samlEnabled = false
// ---------------------------------------------------------------------------
describe("Socket handlers work without auth (samlEnabled=false)", () => {
  let httpServer: http.Server;
  let io: Server;
  let gm: GameManager;
  let port: number;

  function connectClient(): ClientSocket {
    return ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    });
  }

  function waitForConnect(client: ClientSocket): Promise<void> {
    return new Promise((resolve) => {
      client.once("connect", resolve);
    });
  }

  function emitWithAck<T = Record<string, unknown>>(
    client: ClientSocket,
    event: string,
    data: Record<string, unknown>
  ): Promise<T> {
    return new Promise((resolve) => {
      client.emit(event, data, (res: T) => resolve(res));
    });
  }

  beforeAll(async () => {
    httpServer = http.createServer();
    io = new Server(httpServer);
    gm = new GameManager(io);

    registerSocketHandlers(io, gm, false);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    gm.stopAllTimers();
    io.disconnectSockets(true);
    await new Promise((r) => setTimeout(r, 50));
    await clearDB();
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  it("allows room:create with client-supplied userId", async () => {
    const client = connectClient();
    await waitForConnect(client);

    const res = await emitWithAck(client, "room:create", {
      userId: "player1",
      displayName: "Player 1",
      timeControl: 300,
      increment: 0,
      colorChoice: "random",
    });

    expect(res).toEqual(
      expect.objectContaining({ success: true })
    );

    client.disconnect();
  });
});
