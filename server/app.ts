import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'","'unsafe-inline'","'unsafe-eval'"],
      styleSrc:   ["'self'","'unsafe-inline'","https://fonts.googleapis.com"],
      fontSrc:    ["'self'","https://fonts.gstatic.com"],
      imgSrc:     ["'self'","data:","https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

const PgStore = connectPgSimple(session);
app.use(session({
  store: new PgStore({
    conString:            process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret:            process.env.SESSION_SECRET ?? "inventorlab-dev-only",
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
    sameSite: "lax",
  },
}));

// Rate limiting
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many auth requests" } }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 120, message: { error: "Rate limit exceeded" } }));

registerRoutes(app);

export default app;
