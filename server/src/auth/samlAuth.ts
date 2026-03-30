import type { Express, RequestHandler } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { VerifyWithoutRequest } from "@node-saml/passport-saml";

export interface SamlUserProfile {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends SamlUserProfile {}
  }
}

const USER_ID_FIELD = process.env["SAML_USER_ID_FIELD"] || "sub";
const FIRST_NAME_FIELD = process.env["SAML_FIRST_NAME_FIELD"] || "given_name";
const LAST_NAME_FIELD = process.env["SAML_LAST_NAME_FIELD"] || "family_name";

function extractField(profile: Record<string, unknown>, field: string): string {
  const direct = profile[field];
  if (typeof direct === "string" && direct.length > 0) return direct;

  const schemaVariants = [
    `https://schemas.xmlsoap.org/ws/2005/05/identity/claims/${field}`,
    `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/${field}`,
  ];
  for (const variant of schemaVariants) {
    const val = profile[variant];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return "";
}

function profileToUser(profile: Record<string, unknown>): SamlUserProfile {
  const userId = extractField(profile, USER_ID_FIELD)
    || extractField(profile, "upn")
    || extractField(profile, "nameID")
    || "";
  const firstName = extractField(profile, FIRST_NAME_FIELD)
    || extractField(profile, "givenname")
    || "";
  const lastName = extractField(profile, LAST_NAME_FIELD)
    || extractField(profile, "surname")
    || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || userId;

  return { userId, displayName, firstName, lastName };
}

export function setupSamlAuth(app: Express, mongoUri: string): { sessionMiddleware: RequestHandler } {
  const sessionSecret = process.env["SESSION_SECRET"] || "chess-session-secret";
  if (sessionSecret === "chess-session-secret") {
    console.warn("[SECURITY] SESSION_SECRET is set to the default value. Set a strong, unique secret in production.");
  }

  const sessionMiddleware = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri, collectionName: "sessions" }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  const entryPoint = process.env["SAML_ENTRY_POINT"] || "";
  const issuer = process.env["SAML_ISSUER"] || "";
  const callbackUrl = process.env["SAML_CALLBACK_URL"] || "";
  const idpCert = process.env["SAML_IDP_CERT"] || undefined;

  const verify = ((profile: Record<string, unknown>, done: (err: Error | null, user?: SamlUserProfile) => void) => {
    done(null, profileToUser(profile as Record<string, unknown>));
  }) as unknown as VerifyWithoutRequest;

  const samlStrategy = new SamlStrategy(
    {
      entryPoint,
      issuer,
      callbackUrl,
      idpCert: idpCert ?? "",
      authnContext: [
        "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/windows",
      ],
      identifierFormat: null,
      signatureAlgorithm: "sha256",
      wantAuthnResponseSigned: process.env["SAML_WANT_RESPONSE_SIGNED"] !== "false",
      acceptedClockSkewMs: -1,
    },
    verify,
    verify,
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user as unknown as Record<string, unknown>);
  });

  passport.deserializeUser((user: unknown, done) => {
    done(null, user as Express.User);
  });

  passport.use("saml", samlStrategy as unknown as passport.Strategy);

  app.get("/auth/login", passport.authenticate("saml"));

  app.post(
    "/auth/callback",
    passport.authenticate("saml", { failureRedirect: "/auth/login" }),
    (_req, res) => {
      res.redirect("/");
    },
  );

  app.get("/auth/logout", (req, res) => {
    req.logout(() => {
      if (req.session) {
        req.session.destroy(() => {
          res.redirect("/");
        });
      } else {
        res.redirect("/");
      }
    });
  });

  return { sessionMiddleware };
}

export function getSessionUserId(req: { user?: unknown }): string | undefined {
  const user = req.user as { userId?: string } | undefined;
  if (user && typeof user.userId === "string" && user.userId) {
    return user.userId;
  }
  return undefined;
}

export function requireAuth(): RequestHandler {
  return (req, res, next) => {
    const path = req.path;
    if (
      path.startsWith("/auth/") ||
      path === "/healthz" ||
      path === "/readyz" ||
      path.startsWith("/assets/") ||
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".png") ||
      path.endsWith(".ico") ||
      path.endsWith(".svg") ||
      path.endsWith(".woff") ||
      path.endsWith(".woff2") ||
      path.endsWith(".mp3") ||
      path === "/env-config.js"
    ) {
      next();
      return;
    }

    if (req.isAuthenticated?.()) {
      next();
      return;
    }

    if (path.startsWith("/api/")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.redirect("/auth/login");
  };
}
