import { describe, expect, it } from "vitest";
import demo from "@/data/demo-trattoria.json";
import { LANGS } from "@/lib/i18n";
import { mockOrder, mockPersonalize } from "@/lib/mocks";
import { AUDIENCES, CATEGORIES, MenuSchema } from "@/lib/schema";
import { orderOutputSchema, personalizeOutputSchema } from "@/lib/tasks";

const menu = MenuSchema.parse(demo);

describe("mockPersonalize", () => {
  it.each(LANGS)("returns valid output for every category and audience in %s", (lang) => {
    for (const category of CATEGORIES) {
      const dishes = menu.dishes.filter((dish) => dish.category === category);
      const schema = personalizeOutputSchema(dishes.map((dish) => dish.id));
      for (const audience of AUDIENCES) {
        const output = schema.parse(mockPersonalize(menu, dishes, { lang, audience }));
        expect(output.dishes.map((dish) => dish.dishId)).toEqual(dishes.map((dish) => dish.id));
      }
    }
  });

  it("uses the hand-written Japanese text for the demo menu", () => {
    const carbonara = menu.dishes.filter((dish) => dish.id === "carbonara");
    const [output] = mockPersonalize(menu, carbonara, { lang: "ja", audience: "first_timer" }).dishes;
    expect(output.localizedName).toBe("スパゲッティ・アッラ・カルボナーラ");
  });
});

describe("mockOrder", () => {
  const schema = orderOutputSchema(menu);

  it("handles the Japanese demo order", () => {
    const output = schema.parse(
      mockOrder(menu, { lang: "ja" }, "ローマらしい料理をお願いします。でも豚肉は抜きで。6歳の子どもにはシンプルなものを。"),
    );
    expect(output.items).toEqual([
      { dishId: "carbonara", qty: 1 },
      { dishId: "cacio_e_pepe", qty: 1, forWhom: "子ども (6)" },
    ]);
    expect(output.extractedConstraints).toEqual({ allergens: [], diets: ["no_pork"], excludedIngredientIds: [] });
  });

  it("matches dish names, quantities and allergies", () => {
    const output = schema.parse(mockOrder(menu, { lang: "en" }, "2 carbonara and a tiramisu please, I'm allergic to fish"));
    expect(output.items).toEqual([
      { dishId: "carbonara", qty: 2 },
      { dishId: "tiramisu", qty: 1 },
    ]);
    expect(output.extractedConstraints.allergens).toEqual(["fish"]);
  });

  it("asks a clarifying question when nothing matches", () => {
    const output = schema.parse(mockOrder(menu, { lang: "de" }, "Was empfehlen Sie?"));
    expect(output.items).toEqual([]);
    expect(output.unmatchedRequests).toEqual(["Was empfehlen Sie?"]);
    expect(output.clarifyingQuestion).toBeDefined();
  });
});

describe("mockOrder quantities", () => {
  it("reads a quantity written after the dish name", () => {
    const output = orderOutputSchema(menu).parse(mockOrder(menu, { lang: "ja" }, "カルボナーラを2つとティラミス"));
    expect(output.items).toEqual([
      { dishId: "carbonara", qty: 2 },
      { dishId: "tiramisu", qty: 1 },
    ]);
  });
});
