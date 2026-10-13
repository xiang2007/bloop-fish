import { getAuthClient } from "./prisma";

// Counters live in the auth_throttle table, so a limit holds across restarts
// and across every server instance sharing the database. Each key is a
// fixed-window counter: the first hit opens a window, later hits inside it add
// up, and the first hit after it expires starts a fresh one.

// One atomic statement, so concurrent attempts can't slip past the count.
async function bump(key: string, windowMs: number) {
  const seconds = windowMs / 1000;
  const rows = await getAuthClient().$queryRaw<{ count: number }[]>`
    INSERT INTO auth_throttle (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN auth_throttle.window_start < now() - make_interval(secs => ${seconds}::double precision)
                   THEN 1 ELSE auth_throttle.count + 1 END,
      window_start = CASE WHEN auth_throttle.window_start < now() - make_interval(secs => ${seconds}::double precision)
                          THEN now() ELSE auth_throttle.window_start END
    RETURNING count`;
  // Rows are tiny; sweep stale ones now and then instead of running a job.
  if (Math.random() < 0.01) {
    await getAuthClient().$executeRaw`DELETE FROM auth_throttle WHERE window_start < now() - interval '1 day'`;
  }
  return rows[0]?.count ?? 1;
}

export type Limit = { key: string; max: number };

/** True once any of the keys has used up its failures inside the window. */
export async function isLocked(limits: Limit[], windowMs: number) {
  const seconds = windowMs / 1000;
  const rows = await getAuthClient().$queryRaw<{ key: string; count: number }[]>`
    SELECT key, count FROM auth_throttle
    WHERE key = ANY(${limits.map((limit) => limit.key)})
      AND window_start >= now() - make_interval(secs => ${seconds}::double precision)`;
  return rows.some((row) => row.count >= (limits.find((limit) => limit.key === row.key)?.max ?? Infinity));
}

export async function recordFailure(keys: string[], windowMs: number) {
  await Promise.all(keys.map((key) => bump(key, windowMs)));
}

export async function clearFailures(keys: string[]) {
  await getAuthClient().authThrottle.deleteMany({ where: { key: { in: keys } } });
}

/** For actions that are expensive or abusable. False once `key` has used `max` calls inside `windowMs`. */
export async function allow(key: string, max: number, windowMs: number) {
  return (await bump(key, windowMs)) <= max;
}
