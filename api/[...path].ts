// Vercel serverless entry point – re-exports the Express app so Vercel can
// invoke it as a serverless function for all /api/* requests.
import app from "../server/app";

export default app;
