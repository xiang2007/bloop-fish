import { getCookie } from "hono/cookie";
import { getContext } from "hono/context-storage";

// Lets library code read the current request's cookies without passing the
// request through every function (the `contextStorage()` middleware in app.ts
// makes this work). Outside a request (seed scripts) there are no cookies.
export function requestCookie(name: string): string | undefined {
  try {
    return getCookie(getContext(), name);
  } catch {
    return undefined;
  }
}
