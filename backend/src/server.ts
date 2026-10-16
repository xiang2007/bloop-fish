import { config } from "dotenv";
import { serve } from "@hono/node-server";

// Same order as before: .env.local wins over .env.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Loaded after the environment so the database pool sees DATABASE_URL.
const { app } = await import("./app");

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port }, () => console.log(`Fisheye API listening on http://localhost:${port}`));
