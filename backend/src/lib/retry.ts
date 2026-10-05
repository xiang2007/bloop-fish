// Connection trouble is usually brief (a database waking up, a dropped
// network packet). Reads are safe to try again; writes are never retried here.
const RETRYABLE = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|Connection terminated|timeout exceeded when trying to connect/i;

export function isConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return RETRYABLE.test(`${typeof code === "string" ? code : ""} ${typeof message === "string" ? message : ""}`);
}

export async function withRetry<T>(run: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !isConnectionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
