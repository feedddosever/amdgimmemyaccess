import {
  ALLERGEN_CODES,
  TAG_CODES,
  type AllergenCode,
  type DietCode,
  type TagCode,
} from "@/lib/allergens";
import type { DinerProfile, Dish, Ingredient, Menu } from "@/lib/schema";

// Fixed-rule allergen and diet check. No model output ever reaches this file:
// every fact comes from the owner-approved ingredient sheet in the menu JSON.

export type GateReason =
  | { kind: "allergen"; code: AllergenCode; ingredientId: string }
  | { kind: "diet"; code: TagCode | AllergenCode; ingredientId: string }
  | { kind: "excluded"; code: "excluded"; ingredientId: string }
  | { kind: "unverified"; code: "unverified" };

export type GateResult = { allowed: boolean; reasons: GateReason[] };

// Stricter than the tag names alone, so one missing tag on an ingredient cannot let
// meat through: vegetarian blocks every meat tag and the seafood allergens, and
// no_beef also blocks veal.
const ANIMAL_TAGS: readonly TagCode[] = ["pork", "beef", "veal", "lamb", "poultry", "meat", "fish_seafood"];
const SEAFOOD_ALLERGENS: readonly AllergenCode[] = ["fish", "crustaceans", "molluscs"];

export const DIET_RULES: Record<DietCode, { tags: readonly TagCode[]; allergens: readonly AllergenCode[] }> = {
  vegetarian: { tags: ANIMAL_TAGS, allergens: SEAFOOD_ALLERGENS },
  vegan: { tags: ANIMAL_TAGS, allergens: [...SEAFOOD_ALLERGENS, "eggs", "milk"] },
  no_pork: { tags: ["pork"], allergens: [] },
  no_beef: { tags: ["beef", "veal"], allergens: [] },
  no_alcohol: { tags: ["alcohol"], allergens: [] },
};

function ingredientsOf(dish: Dish, menu: Menu): { found: Ingredient[]; missing: string[] } {
  const byId = new Map(menu.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const found: Ingredient[] = [];
  const missing: string[] = [];
  for (const id of new Set(dish.ingredientIds)) {
    const ingredient = byId.get(id);
    if (ingredient) found.push(ingredient);
    else missing.push(id);
  }
  return { found, missing };
}

export function dishAllergens(dish: Dish, menu: Menu): AllergenCode[] {
  const present = new Set(ingredientsOf(dish, menu).found.flatMap((ingredient) => ingredient.allergens));
  return ALLERGEN_CODES.filter((code) => present.has(code));
}

export function dishTags(dish: Dish, menu: Menu): TagCode[] {
  const present = new Set(ingredientsOf(dish, menu).found.flatMap((ingredient) => ingredient.tags));
  return TAG_CODES.filter((code) => present.has(code));
}

export function hasConstraints(profile: DinerProfile): boolean {
  return profile.allergens.length > 0 || profile.diets.length > 0 || profile.excludedIngredientIds.length > 0;
}

export function checkDish(dish: Dish, profile: DinerProfile, menu: Menu): GateResult {
  const { found, missing } = ingredientsOf(dish, menu);
  const reasons: GateReason[] = [];

  // Unapproved data, or an ingredient the sheet does not list, cannot be trusted
  // by anyone who declared a constraint.
  if (hasConstraints(profile) && (!dish.ownerApproved || missing.length > 0)) {
    reasons.push({ kind: "unverified", code: "unverified" });
  }

  const declared = new Set(profile.allergens);
  const blockedTags = new Set(profile.diets.flatMap((diet) => DIET_RULES[diet].tags));
  const blockedDietAllergens = new Set(profile.diets.flatMap((diet) => DIET_RULES[diet].allergens));
  const excluded = new Set(profile.excludedIngredientIds);

  for (const ingredient of found) {
    for (const code of ALLERGEN_CODES) {
      if (declared.has(code) && ingredient.allergens.includes(code)) {
        reasons.push({ kind: "allergen", code, ingredientId: ingredient.id });
      }
    }

    // One diet reason per ingredient, naming the most specific match ("pork" before
    // "meat"); allergens already reported above are not repeated.
    const dietCode = [
      ...TAG_CODES.filter((tag) => blockedTags.has(tag) && ingredient.tags.includes(tag)),
      ...ALLERGEN_CODES.filter(
        (code) => blockedDietAllergens.has(code) && !declared.has(code) && ingredient.allergens.includes(code),
      ),
    ][0];
    if (dietCode) reasons.push({ kind: "diet", code: dietCode, ingredientId: ingredient.id });

    if (excluded.has(ingredient.id)) {
      reasons.push({ kind: "excluded", code: "excluded", ingredientId: ingredient.id });
    }
  }

  return { allowed: reasons.length === 0, reasons };
}
