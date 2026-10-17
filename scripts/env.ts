import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Scripts read .env.local and .env like `next dev` does; real environment variables win.
export function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
      process.env[key] ??= value;
    }
  }
}
