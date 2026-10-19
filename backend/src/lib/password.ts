import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt via node:crypto, stored as "scrypt$<salt hex>$<hash hex>".
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

// No strength rules: any non-empty password is accepted, up to a length login can still check.
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
