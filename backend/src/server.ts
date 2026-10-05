import { config } from "dotenv";
import dns from "node:dns";
import { serve } from "@hono/node-server";

// Some networks resolve the database host to IPv6 addresses they cannot reach;
// try IPv4 first so those connections do not stall.
dns.setDefaultResultOrder("ipv4first");

// Same order as before: .env.local wins over .env.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Loaded after the environment so the database pool sees DATABASE_URL.
const { app } = await import("./app");

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port }, () => console.log(`Fisheye API listening on http://localhost:${port}`));
