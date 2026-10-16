"use client";

// The web app's only way to reach the data: plain fetch calls to the REST API
// under /api (proxied to the backend, see next.config.ts).
import { useEffect, useState } from "react";

// JSON has no dates, so ISO timestamps from the API are turned back into Date
// objects. Day keys like "2026-10-05" have no time part and stay strings.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const revive = (_key: string, value: unknown) =>
  typeof value === "string" && ISO_TIMESTAMP.test(value) ? new Date(value) : value;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Reply<T> = { ok: boolean; status: number; data: T };

/** One call to the API. Never throws for HTTP errors; the caller looks at `ok`. */
export async function send<T = unknown>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text, revive) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data: data as T };
}

// --- Reading data -----------------------------------------------------------

// Every write bumps this, and every mounted `useApi` refetches. This replaces
// the old `revalidatePath`.
let version = 0;
const listeners = new Set<() => void>();

export function invalidate() {
  version += 1;
  listeners.forEach((listener) => listener());
}

type ApiState<T> = { data: T | null; error: ApiError | null };

/** GET `path` (without the /api prefix). Keeps showing the old data while it refetches. */
export function useApi<T>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T> & { path: string }>({ data: null, error: null, path });
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    send<T & { error?: string }>("GET", path).then((reply) => {
      if (cancelled) return;
      if (reply.ok) setState({ data: reply.data, error: null, path });
      else setState({ data: null, error: new ApiError(reply.status, reply.data?.error ?? "Something went wrong"), path });
    });
    return () => {
      cancelled = true;
    };
  }, [path, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data from a previous path is never shown for a new one.
  return state.path === path ? state : { data: null, error: null };
}

// --- Moving between pages after a write ---------------------------------------

type Navigate = (url: string) => void;
let navigate: Navigate = (url) => window.location.assign(url);

/** Set once by NavigationBridge so writes can use client-side navigation. */
export function setNavigate(fn: Navigate) {
  navigate = fn;
}

export function go(url: string) {
  navigate(url);
}
