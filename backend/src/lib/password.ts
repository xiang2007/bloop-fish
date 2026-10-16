import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt via node:crypto, stored as "scrypt$<salt hex>$<hash hex>".
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}

// A hash nobody has the password for, verified when the username is unknown so
// a missing account takes as long to reject as a wrong password.
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(KEY_LENGTH)}`;

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const [scheme, saltHex, hashHex] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  return matches && stored != null;
}

// Passwords that fall to the first guesses an attacker makes. Compared after
// dropping case and punctuation, so "Password-123!" is caught too.
const COMMON = [
  "password", "passw0rd", "qwerty", "qwertyuiop", "letmein", "welcome", "admin", "administrator",
  "iloveyou", "monkey", "dragon", "football", "abc123", "123456", "12345678", "123456789",
  "1234567890", "fisheye", "fishfarm", "ikanmata", "kolam", "ikan", "katalaluan", "katakunci",
];

/**
 * Why a password is too easy to guess, or null if it's acceptable. `personal`
 * is anything about the account (username, name) the password must not contain.
 */
export function passwordProblem(password: string, personal: string[] = []): "short" | "weak" | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "short";
  const flat = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (new Set(password).size < 5) return "weak";
  // A common word on its own, or with only digits or a couple of characters tacked on.
  const padded = (word: string) => {
    if (!flat.includes(word)) return false;
    const rest = flat.replace(word, "");
    return rest.length <= 4 || /^[0-9]+$/.test(rest);
  };
  if (COMMON.some((word) => flat === word || (word.length >= 6 && padded(word)))) return "weak";
  const parts = personal.map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((value) => value.length >= 3);
  if (parts.some((value) => flat.includes(value))) return "weak";
  return null;
}
