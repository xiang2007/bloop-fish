import { handle } from "hono/vercel";
import { app } from "@backend/app";

// Serves the REST API from this deployment when BACKEND_URL is not set (see
// next.config.ts), so Vercel needs no separate API server.
export const runtime = "nodejs";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
