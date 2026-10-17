import { cacheKey } from "@/lib/cache";
import { checkDish, type GateReason } from "@/lib/gate";
import { LANG_NAMES_EN, mentionsChild, t } from "@/lib/i18n";
import { LLMError, generateJSON, type LLMMeta } from "@/lib/llm";
import { mockOrder } from "@/lib/mocks";
import type { DinerProfile, Dish, Menu } from "@/lib/schema";
import { orderOutputSchema, type OrderOutput } from "@/lib/tasks";

export type OrderLine = {
  dishId: string;
  qty: number;
  forWhom?: string;
  noteOriginal?: string;
  noteItalian?: string;
};

export type RemovedLine = OrderLine & { reasons: GateReason[]; alternatives: string[] };

export type OrderResult = {
  // The diner's profile with any allergies, diets or exclusions they wrote in the order.
  profile: DinerProfile;
  items: OrderLine[];
  removed: RemovedLine[];
  unmatchedRequests: string[];
  clarifyingQuestion?: string;
};

export function mergeConstraints(profile: DinerProfile, extracted: OrderOutput["extractedConstraints"], menu: Menu): DinerProfile {
  const ingredientIds = new Set(menu.ingredients.map((ingredient) => ingredient.id));
  return {
    ...profile,
    allergens: [...new Set([...profile.allergens, ...extracted.allergens])],
    diets: [...new Set([...profile.diets, ...extracted.diets])],
    excludedIngredientIds: [
      ...new Set([...profile.excludedIngredientIds, ...extracted.excludedIngredientIds.filter((id) => ingredientIds.has(id))]),
    ],
  };
}

// Up to 2 owner-approved dishes from the same category that pass the gate;
// kid-friendly ones first when the removed dish was for a child. Chosen by code.
export function suggestAlternatives(menu: Menu, profile: DinerProfile, removed: Dish, forWhom?: string): string[] {
  const candidates = menu.dishes.filter(
    (dish) =>
      dish.category === removed.category &&
      dish.id !== removed.id &&
      dish.ownerApproved &&
      checkDish(dish, profile, menu).allowed,
  );
  if (mentionsChild(forWhom)) candidates.sort((a, b) => Number(Boolean(b.kidFriendly)) - Number(Boolean(a.kidFriendly)));
  return candidates.slice(0, 2).map((dish) => dish.id);
}

// Everything after the model, in code: merge constraints, drop unknown ids, gate every item.
export function processOrder(menu: Menu, profile: DinerProfile, output: OrderOutput): OrderResult {
  const merged = mergeConstraints(profile, output.extractedConstraints, menu);
  const dishes = new Map(menu.dishes.map((dish) => [dish.id, dish]));
  const items: OrderLine[] = [];
  const removed: RemovedLine[] = [];

  for (const item of output.items) {
    const dish = dishes.get(item.dishId);
    if (!dish) continue;
    const line: OrderLine = { ...item, qty: Math.min(Math.max(Math.round(item.qty), 1), 10) };
    const result = checkDish(dish, merged, menu);
    if (result.allowed) items.push(line);
    else removed.push({ ...line, reasons: result.reasons, alternatives: suggestAlternatives(menu, merged, dish, item.forWhom) });
  }

  return {
    profile: merged,
    items,
    removed,
    unmatchedRequests: output.unmatchedRequests,
    ...(output.clarifyingQuestion ? { clarifyingQuestion: output.clarifyingQuestion } : {}),
  };
}

function systemPrompt(menu: Menu, profile: DinerProfile): string {
  const language = LANG_NAMES_EN[profile.lang];
  return [
    `You take orders at ${menu.restaurant.name}, a restaurant in ${menu.restaurant.city}. The diner writes in ${language}.`,
    "Map what the diner asks for to dish ids from the menu JSON. Use only ids that appear there.",
    "Choose dishes by what the diner describes (taste, style, course). Do not filter for allergies or diets yourself: put every allergy, diet and ingredient to avoid that the diner mentions in extractedConstraints, and the restaurant's own rules will check every dish after you.",
    "- qty: 1 unless the diner says otherwise; partySize tells you how many people are at the table.",
    `- forWhom: only if the diner says who a dish is for; a few words in ${language}.`,
    `- noteOriginal / noteItalian: only for a special request about a dish (for example "sauce on the side"); noteOriginal in the diner's words, noteItalian translated into Italian for the kitchen.`,
    `- unmatchedRequests: things the diner asked for that are not on the menu, in ${language}.`,
    `- clarifyingQuestion: one short question in ${language}, only if the request is too vague to pick any dish.`,
  ].join("\n");
}

function userPrompt(menu: Menu, profile: DinerProfile, text: string, partySize: number): string {
  const byId = new Map(menu.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return JSON.stringify({
    menu: menu.dishes.map((dish) => ({
      id: dish.id,
      category: dish.category,
      nameIt: dish.nameIt,
      descriptionIt: dish.descriptionIt,
      ingredients: dish.ingredientIds.flatMap((id) => {
        const ingredient = byId.get(id);
        return ingredient ? [{ id, it: ingredient.name.it, en: ingredient.name.en }] : [];
      }),
    })),
    diner: { allergies: profile.allergens, diets: profile.diets },
    partySize,
    text,
  });
}

// The model request for an order; also used by scripts/bench.ts.
export function orderRequest(menu: Menu, profile: DinerProfile, text: string, partySize: number) {
  return {
    task: "order",
    system: systemPrompt(menu, profile),
    user: userPrompt(menu, profile, text, partySize),
    schema: orderOutputSchema(menu),
    maxTokens: 800,
    temperature: 0.1,
  };
}

export async function takeOrder(
  menu: Menu,
  profile: DinerProfile,
  text: string,
  partySize: number,
): Promise<{ result: OrderResult; meta: LLMMeta | null }> {
  try {
    const { data, meta } = await generateJSON({
      ...orderRequest(menu, profile, text, partySize),
      cacheKey: cacheKey({ task: "order", restaurantId: menu.restaurant.id, profile, input: { text, partySize } }),
      mock: () => mockOrder(menu, profile, text),
    });
    return { result: processOrder(menu, profile, data), meta };
  } catch (error) {
    if (!(error instanceof LLMError)) throw error;
    // Safe deterministic answer: nothing ordered, ask the diner to tap dishes instead.
    return {
      result: { profile, items: [], removed: [], unmatchedRequests: [], clarifyingQuestion: t(profile.lang, "orderUnavailable") },
      meta: null,
    };
  }
}
