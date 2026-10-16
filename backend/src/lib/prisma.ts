import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { LARGE_SCENARIO_SCHEMA, SCENARIO_COOKIE, type Scenario } from "@fisheye/shared/scenario";
import { requestCookie } from "./context";

const globalForPrisma = globalThis as unknown as {
  pgPool: Pool | undefined;
  prismaClients: Partial<Record<Scenario, PrismaClient>> | undefined;
  largeScenarioExists: Promise<boolean> | undefined;
};

// One connection pool shared by both scenarios' clients (they differ only in
// the schema their queries name), so switching never doubles the number of
// connections the database has to accept.
// Kept small so scripts (seed, db:scenario) still get connections alongside
// the app; the local PGlite server accepts only 10 in all.
const pool = (globalForPrisma.pgPool ??= createPool());

function createPool() {
  const created = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  // A dropped idle connection is replaced on the next query; without a
  // listener it would crash the server.
  created.on("error", (error) => console.error("Postgres pool error:", error.message));
  return created;
}
const clients = (globalForPrisma.prismaClients ??= {});

function clientFor(scenario: Scenario) {
  return (clients[scenario] ??= new PrismaClient({
    adapter: new PrismaPg(pool, scenario === "large" ? { schema: LARGE_SCENARIO_SCHEMA } : undefined),
  }));
}

// Whether `npm run db:scenario` has been run against this database; checked
// once per server process.
function largeScenarioExists() {
  return (globalForPrisma.largeScenarioExists ??= clientFor("real")
    .$queryRaw<{ found: boolean }[]>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ${LARGE_SCENARIO_SCHEMA} AND table_name = 'ponds') AS found`
    .then((rows) => rows[0]?.found === true)
    .catch(() => false));
}

/** Accounts are shared by both scenarios, so they always use the real schema. */
export function getAuthClient() {
  return clientFor("real");
}

/** The scenario this request shows: the real farm unless the switch chose the 100-pond demo and it exists. */
export async function getScenario(): Promise<Scenario> {
  // Outside a request (scripts) there is no cookie: always the real data.
  const wanted = requestCookie(SCENARIO_COOKIE);
  return wanted === "large" && (await largeScenarioExists()) ? "large" : "real";
}

export async function isLargeScenarioAvailable() {
  return largeScenarioExists();
}

async function currentClient() {
  return clientFor(await getScenario());
}

// `prisma` keeps its usual shape but sends each query to the current
// request's scenario. Model calls and interactive transactions resolve the
// client first, so they return plain promises rather than PrismaPromises:
// use `$transaction(async (tx) => …)`, not the array form.
export const prisma = new Proxy({} as PrismaClient, {
  get(_, property: string | symbol) {
    if (typeof property !== "string" || property === "then") return undefined;
    if (property.startsWith("$")) {
      return (...args: unknown[]) =>
        currentClient().then((client) =>
          (client[property as keyof PrismaClient] as (...a: unknown[]) => unknown).apply(client, args),
        );
    }
    return new Proxy(
      {},
      {
        get(__, method: string | symbol) {
          if (typeof method !== "string" || method === "then") return undefined;
          return (...args: unknown[]) =>
            currentClient().then((client) => {
              const delegate = client[property as keyof PrismaClient] as unknown as Record<string, (...a: unknown[]) => unknown>;
              return delegate[method](...args);
            });
        },
      },
    );
  },
});
