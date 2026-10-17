import { createHash, timingSafeEqual } from "node:crypto";
import { generateJSON, type LLMMeta } from "@/lib/llm";
import { MenuDraftSchema, type MenuDraft } from "@/lib/menuDraft";
import { mockMenuDraft } from "@/lib/mocks";

// /admin/import is open only when ADMIN_PASSCODE is set, and only to whoever knows it.
export function passcodeOk(given: unknown): boolean {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected || typeof given !== "string") return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

const SYSTEM = [
  "You turn an Italian restaurant's menu into JSON for an allergen-aware ordering app.",
  "The restaurant owner checks and approves every field before it is used, so mark allergens conservatively.",
  "- One dish per food item on the menu; skip drinks, cover charge and service.",
  "- dish id: lowercase slug of the Italian name (a-z, 0-9, _). category: antipasti, primi, secondi, contorni or dolci (pizza and mains go in secondi).",
  "- nameIt exactly as on the menu. descriptionIt: the menu's own description, or one short Italian sentence using only the dish's ingredients.",
  "- priceEur from the menu, or null if there is none.",
  "- ingredientIds: the ingredients the menu lists, plus the ones the dish always contains in a traditional Roman recipe (pasta, cheese, egg, wine, stock…).",
  "- ingredients[]: every ingredient once, with id (slug), it (Italian name), en (English name), allergens (EU codes it contains: pasta and bread -> gluten, cheese and butter -> milk, wine and vinegar -> sulphites…) and tags (pork, beef, veal, lamb, poultry, meat, fish_seafood, alcohol).",
  "- Every id in a dish's ingredientIds must appear in ingredients[].",
].join("\n");

export async function draftMenu(menuText: string): Promise<{ draft: MenuDraft; meta: LLMMeta }> {
  const { data, meta } = await generateJSON({
    task: "import",
    system: SYSTEM,
    user: menuText,
    schema: MenuDraftSchema,
    maxTokens: 8000,
    temperature: 0.1,
    mock: () => mockMenuDraft(menuText),
  });
  return { draft: data, meta };
}
