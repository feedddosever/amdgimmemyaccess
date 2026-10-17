import { cacheKey } from "@/lib/cache";
import { findClaim } from "@/lib/claimGuard";
import { LANG_NAMES_EN, type Lang } from "@/lib/i18n";
import { GPU_NAME, LLMError, generateJSON, type LLMMeta, type ServedFrom } from "@/lib/llm";
import { mockPersonalize } from "@/lib/mocks";
import { CATEGORIES, type Audience, type Dish, type Menu } from "@/lib/schema";
import { personalizeOutputSchema } from "@/lib/tasks";

export type DishCopy = { localizedName: string; explanation: string; aiGenerated: boolean };

// Totals for one menu view: the categories are generated in parallel.
export type MenuMeta = {
  model: string;
  servedFrom: ServedFrom;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  tokensPerSec: number;
  costEur: number | null;
  gpu: typeof GPU_NAME;
  qualityRejections: number;
};

export type PersonalizeResponse = {
  lang: Lang;
  audience: Audience;
  dishes: Record<string, DishCopy>;
  // One meta per model call, for the AMD panel (CLAUDE.md rule 8).
  calls: LLMMeta[];
  meta: MenuMeta | null;
  // True when some category could not be generated or loaded from the cache.
  unavailable: boolean;
};

type Profile = { lang: Lang; audience: Audience };

const STYLE: Record<Audience, string> = {
  first_timer: "The diner is in Rome for the first time: say what the dish is and how it is eaten, add one sentence of Roman context, and use plain words.",
  foodie: "The diner loves food: mention the origin, the technique and one detail locals care about.",
  family: "The diner is a family with children: use simple words and say whether children usually like the dish.",
  dietary: "The diner has dietary needs: give a neutral description of the dish only.",
};

function systemPrompt(menu: Menu, profile: Profile, retry: boolean): string {
  const language = LANG_NAMES_EN[profile.lang];
  return [
    `You write menu descriptions for diners at ${menu.restaurant.name}, a restaurant in ${menu.restaurant.city}.`,
    `Write every localizedName and explanation in ${language}.`,
    STYLE[profile.audience],
    "Rules:",
    `- localizedName: the dish name in ${language}; keep the Italian name recognisable (transliterate it if the script differs).`,
    "- explanation: at most 2 short sentences.",
    "- Use only the ingredients listed for each dish. Never add ingredients.",
    "- Never mention allergens or intolerances.",
    "- Never say or imply that a dish is safe, suitable for someone, free from anything, vegetarian or vegan.",
    "- Return every dish id you are given exactly once.",
    ...(retry
      ? ["Your previous text for these dishes was rejected because it made a safety or diet claim. Describe the food only."]
      : []),
  ].join("\n");
}

function userPrompt(menu: Menu, dishes: Dish[]): string {
  const byId = new Map(menu.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return JSON.stringify({
    dishes: dishes.map((dish) => ({
      id: dish.id,
      nameIt: dish.nameIt,
      descriptionIt: dish.descriptionIt,
      ingredients: dish.ingredientIds.flatMap((id) => {
        const ingredient = byId.get(id);
        return ingredient ? [ingredient.name] : [];
      }),
    })),
  });
}

function italianCopy(dish: Dish): DishCopy {
  return { localizedName: dish.nameIt, explanation: dish.descriptionIt, aiGenerated: false };
}

// The model request for one category; also used by scripts/bench.ts.
export function personalizeRequest(menu: Menu, dishes: Dish[], profile: Profile, retry = false) {
  return {
    task: "personalize",
    system: systemPrompt(menu, profile, retry),
    user: userPrompt(menu, dishes),
    schema: personalizeOutputSchema(dishes.map((dish) => dish.id)),
    maxTokens: 120 + dishes.length * 160,
    temperature: 0.3,
  };
}

async function generate(menu: Menu, dishes: Dish[], profile: Profile, retry: boolean) {
  return generateJSON({
    ...personalizeRequest(menu, dishes, profile, retry),
    cacheKey: cacheKey({
      task: "personalize",
      restaurantId: menu.restaurant.id,
      profile,
      input: { dishIds: dishes.map((dish) => dish.id), retry },
    }),
    mock: () => mockPersonalize(menu, dishes, profile),
  });
}

async function personalizeCategory(menu: Menu, dishes: Dish[], profile: Profile) {
  const copies: Record<string, DishCopy> = {};
  const calls: LLMMeta[] = [];
  let rejections = 0;
  let pending = dishes;

  for (const retry of [false, true]) {
    if (pending.length === 0) break;
    try {
      const { data, meta } = await generate(menu, pending, profile, retry);
      const returned = new Map(data.dishes.map((dish) => [dish.dishId, dish]));
      const rejected: Dish[] = [];
      for (const dish of pending) {
        const copy = returned.get(dish.id);
        if (copy && !findClaim(copy.localizedName, copy.explanation)) {
          copies[dish.id] = { localizedName: copy.localizedName, explanation: copy.explanation, aiGenerated: true };
        } else {
          rejected.push(dish);
        }
      }
      const callRejections = rejected.filter((dish) => returned.has(dish.id)).length;
      rejections += callRejections;
      calls.push({ ...meta, qualityRejections: callRejections });
      pending = rejected;
    } catch (error) {
      if (!(error instanceof LLMError)) throw error;
      break;
    }
  }

  // Still missing or still making claims: show the restaurant's own Italian text.
  for (const dish of pending) copies[dish.id] = italianCopy(dish);
  return { copies, calls, rejections, unavailable: calls.length === 0 };
}

function summarize(calls: LLMMeta[], latencyMs: number, qualityRejections: number): MenuMeta | null {
  if (calls.length === 0) return null;
  const promptTokens = calls.reduce((sum, call) => sum + call.promptTokens, 0);
  const completionTokens = calls.reduce((sum, call) => sum + call.completionTokens, 0);
  const costs = calls.map((call) => call.costEur);
  const servedFrom: ServedFrom = calls.every((call) => call.servedFrom === "mock")
    ? "mock"
    : calls.some((call) => call.servedFrom === "cache")
      ? "cache"
      : "live";
  return {
    model: calls[0].model,
    servedFrom,
    latencyMs,
    promptTokens,
    completionTokens,
    tokensPerSec: latencyMs > 0 ? completionTokens / (latencyMs / 1000) : 0,
    costEur: costs.some((cost) => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0),
    gpu: GPU_NAME,
    qualityRejections,
  };
}

// One model call per menu category, in parallel.
export async function personalizeMenu(menu: Menu, profile: Profile): Promise<PersonalizeResponse> {
  const startedAt = Date.now();
  const categories = CATEGORIES.map((category) => menu.dishes.filter((dish) => dish.category === category)).filter(
    (dishes) => dishes.length > 0,
  );
  const results = await Promise.all(categories.map((dishes) => personalizeCategory(menu, dishes, profile)));
  const calls = results.flatMap((result) => result.calls);
  const rejections = results.reduce((sum, result) => sum + result.rejections, 0);
  return {
    lang: profile.lang,
    audience: profile.audience,
    dishes: Object.assign({}, ...results.map((result) => result.copies)),
    calls,
    meta: summarize(calls, Date.now() - startedAt, rejections),
    unavailable: results.some((result) => result.unavailable),
  };
}
