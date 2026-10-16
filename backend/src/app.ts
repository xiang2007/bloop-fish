import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { HttpError } from "./lib/http";
import { sessionRoutes } from "./routes/session";
import { readRoutes } from "./routes/read";
import { writeRoutes } from "./routes/write";

// The whole REST API lives under /api. Routes are listed in docs/API.md.
export const app = new Hono();

// Lets lib code read the current request's cookies (see lib/context.ts).
app.use(contextStorage());

app.route("/api", sessionRoutes);
app.route("/api", readRoutes);
app.route("/api", writeRoutes);

app.get("/api/health", (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Errors always come back as JSON: { error: "message" }.
app.onError((error, c) => {
  if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
  console.error(error);
  return c.json({ error: "Something went wrong" }, 500);
});
