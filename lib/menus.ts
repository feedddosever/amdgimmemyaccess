import { readFile } from "node:fs/promises";
import path from "node:path";
import { MenuSchema, type Menu } from "@/lib/schema";

const RESTAURANT_ID = /^[a-z0-9][a-z0-9_-]*$/;

// Menus are owner-approved JSON files in data/<restaurant-id>.json.
export async function getMenu(restaurantId: string): Promise<Menu | null> {
  "use cache";
  if (!RESTAURANT_ID.test(restaurantId)) return null;
  try {
    const raw = await readFile(path.join(process.cwd(), "data", `${restaurantId}.json`), "utf8");
    return MenuSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(`menu ${restaurantId} is invalid`, error);
    return null;
  }
}
