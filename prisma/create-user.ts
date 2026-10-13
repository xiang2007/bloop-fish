// Creates (or resets the password of) an account. The first owner has to come
// from here, since only an owner can add people in the app.
//
//   npm run user:create -- <username> "<Full name>" <owner|worker>
//
// The password is asked for on the terminal, so it never lands in shell history.
// Where there is no terminal to type into, set FISHEYE_PASSWORD instead.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { MIN_PASSWORD_LENGTH, hashPassword, passwordProblem } from "../lib/password";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

function askHidden(question: string) {
  return new Promise<string>((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") process.exit(130);
        if (char === "\r" || char === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (char === "\u007f") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [rawUsername, name, role] = process.argv.slice(2);
  const username = rawUsername?.toLowerCase();
  if (!username || !/^[a-z0-9._-]{3,30}$/.test(username) || !name || (role !== "owner" && role !== "worker")) {
    console.error('Usage: npm run user:create -- <username> "<Full name>" <owner|worker>');
    process.exit(1);
  }

  const fromEnv = process.env.FISHEYE_PASSWORD;
  const password = fromEnv ?? (await askHidden(`Password for ${username}: `));
  const problem = passwordProblem(password, [username, name]);
  if (problem === "short") {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  if (problem === "weak") {
    console.error("That password is too easy to guess. Avoid common words and your own name or username.");
    process.exit(1);
  }
  if (fromEnv === undefined && password !== (await askHidden("Repeat password: "))) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { username },
      // Resetting an account also ends its existing sessions.
      update: { name, role, passwordHash, active: true, sessionVersion: { increment: 1 } },
      create: { username, name, role, passwordHash },
    });
    console.log(`${user.role} "${user.username}" (${user.name}) is ready to sign in.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
