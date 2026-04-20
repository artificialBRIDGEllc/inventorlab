import express from "express";
import path from "path";
import fs from "fs";
import app from "./app";

const PORT = parseInt(process.env.PORT ?? "5001", 10);

// Serve React frontend in production.
// process.cwd() is the project root when started via `node dist/server/index.js`
// from the project root (as Railway's start command does).
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), "dist", "public");
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get("/*splat", (_req, res) => res.sendFile(path.join(publicPath, "index.html")));
  }
}

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`[inventorlab] Server running on port ${PORT}`);
});

export default app;
