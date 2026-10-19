// Only same-site paths are safe to redirect to. Browsers read a backslash as a
// slash, so "/\\evil.com" is as dangerous as "//evil.com".
export function safePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}
