import { describe, expect, it } from "vitest";
import demo from "@/data/demo-trattoria.json";
import { DinerProfileSchema, MenuSchema } from "@/lib/schema";

describe("MenuSchema", () => {
  it("accepts the demo menu", () => {
    expect(MenuSchema.safeParse(demo).success).toBe(true);
  });

  it("rejects a dish that points at an unknown ingredient", () => {
    const menu = structuredClone(demo);
    menu.dishes[0].ingredientIds.push("mystery_sauce");
    const result = MenuSchema.safeParse(menu);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('unknown ingredient id "mystery_sauce"');
  });

  it("rejects duplicate dish ids", () => {
    const menu = structuredClone(demo);
    menu.dishes.push(structuredClone(menu.dishes[0]));
    expect(MenuSchema.safeParse(menu).success).toBe(false);
  });

  it("rejects allergen codes outside the EU list", () => {
    const menu = structuredClone(demo);
    menu.ingredients[0].allergens.push("shellfish");
    expect(MenuSchema.safeParse(menu).success).toBe(false);
  });
});

describe("DinerProfileSchema", () => {
  it("defaults allergens, diets and excluded ingredients to empty", () => {
    expect(DinerProfileSchema.parse({ lang: "ja", audience: "first_timer" })).toEqual({
      lang: "ja",
      audience: "first_timer",
      allergens: [],
      diets: [],
      excludedIngredientIds: [],
    });
  });

  it("rejects an unsupported language", () => {
    expect(DinerProfileSchema.safeParse({ lang: "pt", audience: "foodie" }).success).toBe(false);
  });
});
