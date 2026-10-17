import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DinerProfile } from "@/lib/schema";

// Saved model outputs in data/cache, served when the GPU is unreachable.
// Only the warm-cache script writes them (CACHE_WRITE=1); Vercel's file system is read-only.

const KEY_PATTERN = /^[a-z0-9_-]+$/;

export function cacheDir(): string {
  return process.env.CACHE_DIR || path.join(process.cwd(), "data", "cache");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, sortKeys(inner)]),
    );
  }
  return value;
}

// Pass only the profile fields the task's output depends on (personalize uses
// lang and audience), so diners with different allergies share a cache entry.
export function cacheKey(parts: {
  task: string;
  restaurantId: string;
  profile?: Partial<DinerProfile>;
  input?: unknown;
}): string {
  const profile = parts.profile && {
    ...parts.profile,
    ...(parts.profile.allergens && { allergens: [...parts.profile.allergens].sort() }),
    ...(parts.profile.diets && { diets: [...parts.profile.diets].sort() }),
    ...(parts.profile.excludedIngredientIds && {
      excludedIngredientIds: [...parts.profile.excludedIngredientIds].sort(),
    }),
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(sortKeys({ profile: profile ?? null, input: parts.input ?? null })))
    .digest("hex")
    .slice(0, 16);
  return `${parts.task}--${parts.restaurantId}--${hash}`;
}

function cachePath(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error(`invalid cache key "${key}"`);
  return path.join(cacheDir(), `${key}.json`);
}

export async function readCache(key: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(cachePath(key), "utf8"));
  } catch {
    return null;
  }
}

export async function writeCache(key: string, entry: unknown): Promise<boolean> {
  if (process.env.CACHE_WRITE !== "1") return false;
  const file = cachePath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`);
  return true;
}
