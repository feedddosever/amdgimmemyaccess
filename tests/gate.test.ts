import { describe, expect, it } from "vitest";
import demo from "@/data/demo-trattoria.json";
import { ALLERGEN_CODES } from "@/lib/allergens";
import { checkDish, dishAllergens, dishTags, type GateReason } from "@/lib/gate";
import { LANGS, formatReason } from "@/lib/i18n";
import { DinerProfileSchema, MenuSchema, type DinerProfile, type Dish } from "@/lib/schema";

const menu = MenuSchema.parse(demo);

function dish(id: string): Dish {
  const found = menu.dishes.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no dish ${id}`);
  return found;
}

function diner(overrides: Partial<DinerProfile> = {}): DinerProfile {
  return DinerProfileSchema.parse({ lang: "en", audience: "first_timer", ...overrides });
}

describe("demo menu", () => {
  it("has 13 dishes, all owner-approved except the piatto del giorno", () => {
    expect(menu.dishes).toHaveLength(13);
    expect(menu.dishes.filter((d) => !d.ownerApproved).map((d) => d.id)).toEqual(["piatto_del_giorno"]);
  });

  it("computes a dish's allergens and tags from its ingredients", () => {
    expect(dishAllergens(dish("carbonara"), menu)).toEqual(["gluten", "eggs", "milk"]);
    expect(dishTags(dish("carbonara"), menu)).toEqual(["pork", "meat"]);
    expect(dishAllergens(dish("puntarelle"), menu)).toEqual(["fish", "sulphites"]);
    expect(dishTags(dish("puntarelle"), menu)).toEqual(["fish_seafood"]);
    expect(dishTags(dish("coda_alla_vaccinara"), menu)).toEqual(["beef", "meat", "alcohol"]);
  });
});

describe("checkDish", () => {
  it("blocks carbonara for no_pork because of guanciale", () => {
    expect(checkDish(dish("carbonara"), diner({ diets: ["no_pork"] }), menu)).toEqual({
      allowed: false,
      reasons: [{ kind: "diet", code: "pork", ingredientId: "guanciale" }],
    });
  });

  it("allows carbonara for an empty profile", () => {
    expect(checkDish(dish("carbonara"), diner(), menu)).toEqual({ allowed: true, reasons: [] });
  });

  it("blocks puntarelle for a fish allergy (anchovy)", () => {
    const result = checkDish(dish("puntarelle"), diner({ allergens: ["fish"] }), menu);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual([{ kind: "allergen", code: "fish", ingredientId: "anchovy" }]);
  });

  it("blocks coda alla vaccinara for a celery allergy", () => {
    const result = checkDish(dish("coda_alla_vaccinara"), diner({ allergens: ["celery"] }), menu);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual([{ kind: "allergen", code: "celery", ingredientId: "celery" }]);
  });

  it("blocks tiramisu for vegan", () => {
    const result = checkDish(dish("tiramisu"), diner({ diets: ["vegan"] }), menu);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual([
      { kind: "diet", code: "milk", ingredientId: "mascarpone" },
      { kind: "diet", code: "eggs", ingredientId: "egg" },
      { kind: "diet", code: "eggs", ingredientId: "savoiardi" },
    ]);
  });

  it("allows cicoria ripassata for vegan", () => {
    expect(checkDish(dish("cicoria_ripassata"), diner({ diets: ["vegan"] }), menu).allowed).toBe(true);
  });

  it("blocks supplì for vegetarian", () => {
    const result = checkDish(dish("suppli"), diner({ diets: ["vegetarian"] }), menu);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual([{ kind: "diet", code: "beef", ingredientId: "minced_beef" }]);
  });

  it.each(ALLERGEN_CODES)("blocks the piatto del giorno as unverified for a %s allergy", (code) => {
    expect(checkDish(dish("piatto_del_giorno"), diner({ allergens: [code] }), menu)).toEqual({
      allowed: false,
      reasons: [{ kind: "unverified", code: "unverified" }],
    });
  });

  it("blocks the piatto del giorno as unverified for any diet or excluded ingredient", () => {
    expect(checkDish(dish("piatto_del_giorno"), diner({ diets: ["no_alcohol"] }), menu).allowed).toBe(false);
    expect(checkDish(dish("piatto_del_giorno"), diner({ excludedIngredientIds: ["onion"] }), menu).allowed).toBe(false);
    expect(checkDish(dish("piatto_del_giorno"), diner(), menu).allowed).toBe(true);
  });

  it("blocks veal for no_beef", () => {
    const result = checkDish(dish("saltimbocca"), diner({ diets: ["no_beef"] }), menu);
    expect(result.reasons).toEqual([{ kind: "diet", code: "veal", ingredientId: "veal" }]);
  });

  it("blocks fish for vegetarian", () => {
    const result = checkDish(dish("puntarelle"), diner({ diets: ["vegetarian"] }), menu);
    expect(result.reasons).toEqual([{ kind: "diet", code: "fish_seafood", ingredientId: "anchovy" }]);
  });

  it("gives one diet reason per ingredient, naming the most specific tag", () => {
    const result = checkDish(dish("carbonara"), diner({ diets: ["vegetarian", "no_pork"] }), menu);
    expect(result.reasons).toEqual([{ kind: "diet", code: "pork", ingredientId: "guanciale" }]);
  });

  it("does not repeat a declared allergen as a diet reason", () => {
    const result = checkDish(dish("cacio_e_pepe"), diner({ allergens: ["milk"], diets: ["vegan"] }), menu);
    expect(result.reasons).toEqual([{ kind: "allergen", code: "milk", ingredientId: "pecorino" }]);
  });

  it("blocks dishes with an excluded ingredient", () => {
    const result = checkDish(dish("coda_alla_vaccinara"), diner({ excludedIngredientIds: ["onion"] }), menu);
    expect(result.reasons).toEqual([{ kind: "excluded", code: "excluded", ingredientId: "onion" }]);
  });

  it("treats an ingredient missing from the sheet as unverified for a diner with constraints", () => {
    const broken: Dish = { ...dish("cicoria_ripassata"), ingredientIds: ["chicory", "mystery_sauce"] };
    expect(checkDish(broken, diner({ allergens: ["peanuts"] }), menu).reasons).toEqual([
      { kind: "unverified", code: "unverified" },
    ]);
    expect(checkDish(broken, diner(), menu).allowed).toBe(true);
  });
});

describe("reason strings", () => {
  const pork: GateReason = { kind: "diet", code: "pork", ingredientId: "guanciale" };
  const fish: GateReason = { kind: "allergen", code: "fish", ingredientId: "anchovy" };
  const unverified: GateReason = { kind: "unverified", code: "unverified" };
  const excluded: GateReason = { kind: "excluded", code: "excluded", ingredientId: "onion" };

  it("renders in Italian", () => {
    expect(formatReason(pork, "it", menu)).toBe("Contiene guanciale (maiale)");
    expect(formatReason(fish, "it", menu)).toBe("Contiene alici (pesce)");
    expect(formatReason(unverified, "it", menu)).toBe(
      "Il ristorante non ha ancora confermato gli allergeni di questo piatto",
    );
  });

  it("renders in Japanese, with the ingredient named in Japanese", () => {
    expect(formatReason(pork, "ja", menu)).toBe("豚ほほ肉の塩漬け（豚肉）を含みます");
    expect(formatReason(fish, "ja", menu)).toBe("アンチョビ（魚）を含みます");
    expect(formatReason(unverified, "ja", menu)).toBe("この料理のアレルゲン情報は、まだ店舗で確認されていません");
  });

  it("names every demo ingredient in every diner language", () => {
    for (const ingredient of menu.ingredients) {
      for (const lang of LANGS) expect(ingredient.name[lang], `${ingredient.id} in ${lang}`).toBeTruthy();
    }
  });

  it("falls back to the English name when the sheet has none in the diner's language", () => {
    const sheet = MenuSchema.parse({
      ...demo,
      ingredients: demo.ingredients.map(({ id, name, allergens, tags }) => ({ id, name: { it: name.it, en: name.en }, allergens, tags })),
    });
    expect(formatReason(pork, "ja", sheet)).toBe("cured pork cheek（豚肉）を含みます");
  });

  it.each(LANGS)("fills every placeholder in %s", (lang) => {
    for (const reason of [pork, fish, unverified, excluded]) {
      expect(formatReason(reason, lang, menu)).not.toMatch(/[{}]/);
    }
  });
});
