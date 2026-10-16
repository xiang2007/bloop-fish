import { isIP } from "node:net";

// The address a request really came from, or null when it can't be told.
//
// X-Forwarded-For is only as honest as the proxy that wrote it: a client can
// send its own, and each proxy appends the address it saw to the right. So the
// only trustworthy entry is the one the Nth proxy from the server added, where
// N is how many proxies sit in front of the app (1 for Vercel or a single
// nginx). With none configured nothing is trusted, and callers fall back to a
// coarser limit rather than keying on a value an attacker chooses.
export function clientIp(headers: Headers): string | null {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
  if (!Number.isInteger(hops) || hops < 1) return null;

  const entries = (headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const candidate = entries.length >= hops ? entries[entries.length - hops] : headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}
