import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = parseInt(process.env.PORT ?? "5001", 10);

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
    conString:           process.env.DATABASE_URL,
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

// Serve React frontend in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get("*", (_req, res) => res.sendFile(path.join(publicPath, "index.html")));
  }
}

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`[inventorlab] Server running on port ${PORT}`);
});

export default app;
