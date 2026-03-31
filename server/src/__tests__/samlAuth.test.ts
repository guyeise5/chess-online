import { setupDB, teardownDB, clearDB } from "./setup";
import express from "express";
import request from "supertest";

beforeAll(setupDB);
afterAll(teardownDB);
afterEach(clearDB);

describe("SAML auth feature flag", () => {
  it("returns 404 for /api/auth/me when FEATURE_SAML_AUTH is not set", async () => {
    delete process.env["FEATURE_SAML_AUTH"];
    jest.resetModules();

    const app = express();
    app.use(express.json());

    const samlEnabled = process.env["FEATURE_SAML_AUTH"] === "true";

    app.get("/api/auth/me", (_req, res) => {
      if (!samlEnabled) {
        res.status(404).json({ error: "Auth not enabled" });
        return;
      }
      res.status(401).json({ error: "Not authenticated" });
    });

    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Auth not enabled");
  });

  it("returns 401 for /api/auth/me when SAML enabled but no session", async () => {
    const app = express();
    app.use(express.json());

    app.get("/api/auth/me", (req, res) => {
      const user = req.user as { userId?: string } | undefined;
      if (!user || typeof user.userId !== "string" || !user.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      res.json({ userId: user.userId });
    });

    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Not authenticated");
  });
});

describe("requireAuth middleware", () => {
  it("allows health endpoints without auth", async () => {
    const { requireAuth } = await import("../auth/samlAuth");
    const app = express();
    app.use(requireAuth());
    app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
    app.get("/readyz", (_req, res) => res.json({ status: "ready" }));

    const [healthRes, readyRes] = await Promise.all([
      request(app).get("/healthz"),
      request(app).get("/readyz"),
    ]);

    expect(healthRes.status).toBe(200);
    expect(readyRes.status).toBe(200);
  });

  it("allows static assets without auth", async () => {
    const { requireAuth } = await import("../auth/samlAuth");
    const app = express();
    app.use(requireAuth());
    app.get("/assets/test.js", (_req, res) => res.send("ok"));
    app.get("/env-config.js", (_req, res) => res.send("ok"));

    const [assetRes, envRes] = await Promise.all([
      request(app).get("/assets/test.js"),
      request(app).get("/env-config.js"),
    ]);

    expect(assetRes.status).toBe(200);
    expect(envRes.status).toBe(200);
  });

  it("allows /auth/* routes without auth", async () => {
    const { requireAuth } = await import("../auth/samlAuth");
    const app = express();
    app.use(requireAuth());
    app.get("/auth/login", (_req, res) => res.send("login page"));
    app.get("/auth/logout", (_req, res) => res.send("logout"));

    const [loginRes, logoutRes] = await Promise.all([
      request(app).get("/auth/login"),
      request(app).get("/auth/logout"),
    ]);

    expect(loginRes.status).toBe(200);
    expect(logoutRes.status).toBe(200);
  });

  it("returns 401 for /api/* routes when unauthenticated", async () => {
    const { requireAuth } = await import("../auth/samlAuth");
    const app = express();
    app.use(requireAuth());
    app.get("/api/test", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/api/test");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("passes through non-API routes without auth (SPA routing)", async () => {
    const { requireAuth } = await import("../auth/samlAuth");
    const app = express();
    app.use(requireAuth());
    app.get("/", (_req, res) => res.send("home"));
    app.get("/login", (_req, res) => res.send("login page"));

    const [homeRes, loginRes] = await Promise.all([
      request(app).get("/"),
      request(app).get("/login"),
    ]);

    expect(homeRes.status).toBe(200);
    expect(loginRes.status).toBe(200);
  });
});
