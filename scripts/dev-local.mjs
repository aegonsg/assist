import { spawn } from "node:child_process";
import { resolve } from "node:path";
import nextEnv from "@next/env";

const localKeys = [
  "JWT_SECRET",
  "OWNER_USERNAME",
  "OWNER_PASSWORD_HASH",
  "OWNER_NAME",
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "PUSH_CONTACT_EMAIL",
  "AI_BASE_URL",
  "AI_API_KEY",
  "GROQ_API_KEY",
  "AI_MODEL",
];
for (const key of localKeys) delete process.env[key];
nextEnv.loadEnvConfig(process.cwd());

for (const key of ["JWT_SECRET", "OWNER_USERNAME", "OWNER_PASSWORD_HASH", "MONGODB_URI"]) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env.local.`);
}

const nextCli = resolve("node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
