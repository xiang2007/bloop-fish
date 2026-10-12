// Throttles failed sign-ins per client: MAX_FAILURES wrong passwords locks that
// client out for WINDOW_MS. Held in memory, so it resets on restart and is per
// server instance; put a shared store behind it if the app runs on several.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map<string, { count: number; first: number }>();

function current(client: string) {
  const entry = failures.get(client);
  if (entry && Date.now() - entry.first > WINDOW_MS) {
    failures.delete(client);
    return undefined;
  }
  return entry;
}

export function isLocked(client: string) {
  return (current(client)?.count ?? 0) >= MAX_FAILURES;
}

export function recordFailure(client: string) {
  const entry = current(client);
  if (entry) entry.count += 1;
  else failures.set(client, { count: 1, first: Date.now() });
  // Keep the map from growing without bound under a spray of addresses.
  if (failures.size > 5000) failures.delete(failures.keys().next().value as string);
}

export function clearFailures(client: string) {
  failures.delete(client);
}

// Fixed-window counter for actions that are expensive or abusable. Returns
// false once `key` has used `max` calls within `windowMs`.
const hits = new Map<string, { count: number; first: number }>();

export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.first > windowMs) {
    if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
    hits.set(key, { count: 1, first: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
