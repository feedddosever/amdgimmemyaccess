import { afterEach, describe, expect, it, vi } from "vitest";
import demo from "@/data/demo-trattoria.json";
import { processOrder, takeOrder } from "@/lib/order";
import { DinerProfileSchema, MenuSchema, type DinerProfile } from "@/lib/schema";
import type { OrderOutput } from "@/lib/tasks";
import { buildTicket } from "@/lib/ticket";

const menu = MenuSchema.parse(demo);

function diner(overrides: Partial<DinerProfile> = {}): DinerProfile {
  return DinerProfileSchema.parse({ lang: "en", audience: "first_timer", ...overrides });
}

function output(overrides: Partial<OrderOutput> = {}): OrderOutput {
  return {
    items: [],
    extractedConstraints: { allergens: [], diets: [], excludedIngredientIds: [] },
    unmatchedRequests: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("processOrder", () => {
  it("removes carbonara for a diner who wrote 'no pork'", () => {
    const result = processOrder(
      menu,
      diner(),
      output({
        items: [{ dishId: "carbonara", qty: 1 }],
        extractedConstraints: { allergens: [], diets: ["no_pork"], excludedIngredientIds: [] },
      }),
    );
    expect(result.items).toEqual([]);
    expect(result.removed).toEqual([
      {
        dishId: "carbonara",
        qty: 1,
        reasons: [{ kind: "diet", code: "pork", ingredientId: "guanciale" }],
        alternatives: ["cacio_e_pepe"],
      },
    ]);
    expect(result.profile.diets).toEqual(["no_pork"]);
  });

  it("drops dish ids that are not on the menu", () => {
    const result = processOrder(menu, diner(), output({ items: [{ dishId: "pizza_margherita", qty: 1 }, { dishId: "tiramisu", qty: 2 }] }));
    expect(result.items).toEqual([{ dishId: "tiramisu", qty: 2 }]);
    expect(result.removed).toEqual([]);
  });

  it("never lets a diner with a fish allergy get puntarelle, even if the model returns it", () => {
    const result = processOrder(menu, diner({ allergens: ["fish"] }), output({ items: [{ dishId: "puntarelle", qty: 1 }] }));
    expect(result.items).toEqual([]);
    expect(result.removed[0]).toMatchObject({
      dishId: "puntarelle",
      reasons: [{ kind: "allergen", code: "fish", ingredientId: "anchovy" }],
    });
  });

  it("suggests kid-friendly alternatives first when the dish was for a child", () => {
    const result = processOrder(
      menu,
      diner({ diets: ["no_pork"] }),
      output({ items: [{ dishId: "saltimbocca", qty: 1, forWhom: "my 6-year-old child" }] }),
    );
    expect(result.removed[0].alternatives).toEqual(["coda_alla_vaccinara", "abbacchio_scottadito"]);

    const forChild = processOrder(menu, diner({ allergens: ["milk"] }), output({ items: [{ dishId: "carbonara", qty: 1, forWhom: "child" }] }));
    expect(forChild.removed[0].alternatives).toEqual([]);

    const pasta = processOrder(menu, diner({ allergens: ["eggs"] }), output({ items: [{ dishId: "carbonara", qty: 1, forWhom: "子ども" }] }));
    expect(pasta.removed[0].alternatives).toEqual(["cacio_e_pepe", "gricia"]);
  });

  it("ignores excluded ingredient ids that are not on the menu", () => {
    const result = processOrder(
      menu,
      diner(),
      output({ extractedConstraints: { allergens: [], diets: [], excludedIngredientIds: ["onion", "truffle"] } }),
    );
    expect(result.profile.excludedIngredientIds).toEqual(["onion"]);
  });
});

describe("takeOrder", () => {
  it("handles the Japanese demo order end to end with MOCK_LLM=1", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    const { result, meta } = await takeOrder(
      menu,
      diner({ lang: "ja" }),
      "ローマらしい料理をお願いします。でも豚肉は抜きで。6歳の子どもにはシンプルなものを。",
      2,
    );
    expect(result.items).toEqual([{ dishId: "cacio_e_pepe", qty: 1, forWhom: "子ども (6)" }]);
    expect(result.removed).toEqual([
      {
        dishId: "carbonara",
        qty: 1,
        reasons: [{ kind: "diet", code: "pork", ingredientId: "guanciale" }],
        alternatives: ["cacio_e_pepe"],
      },
    ]);
    expect(meta?.servedFrom).toBe("mock");
  });

  it("answers with a clarifying question when the model is unreachable", async () => {
    vi.stubEnv("MOCK_LLM", "0");
    vi.stubEnv("LLM_BASE_URL", "http://gpu.test:8000/v1");
    vi.stubEnv("CACHE_DIR", "/nonexistent-menubridge-cache");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const { result, meta } = await takeOrder(menu, diner({ lang: "it" }), "una carbonara", 1);
    expect(meta).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.clarifyingQuestion).toContain("Aggiungi");
  });
});

describe("buildTicket", () => {
  it("writes the ticket in Italian and drops anything the gate blocks", () => {
    const profile = diner({ lang: "ja", allergens: ["fish"], diets: ["no_pork"], excludedIngredientIds: ["onion"] });
    const ticket = buildTicket({
      menu,
      profile,
      lines: [
        { dishId: "cacio_e_pepe", qty: 1, forWhom: "子ども (6)" },
        { dishId: "tiramisu", qty: 2, noteOriginal: "スプーン2本", noteItalian: "Due cucchiai" },
        { dishId: "carbonara", qty: 1 },
        { dishId: "puntarelle", qty: 1 },
      ],
      table: "7",
      partySize: 2,
      ticketId: "t1",
      createdAt: "2026-10-17T19:30:00.000Z",
    });
    expect(ticket).toEqual({
      ticketId: "t1",
      table: "7",
      createdAt: "2026-10-17T19:30:00.000Z",
      dinerLang: "ja",
      partySize: 2,
      items: [
        { nameIt: "Tonnarelli cacio e pepe", qty: 1, forWhom: "bambino, 6 anni", allergenFlagsIt: ["glutine", "latte"] },
        { nameIt: "Tiramisù", qty: 2, noteItalian: "Due cucchiai", allergenFlagsIt: ["glutine", "uova", "latte"] },
      ],
      dinerAllergiesIt: ["pesce"],
      dinerDietsIt: ["senza maiale"],
      dinerExcludedIt: ["cipolla"],
      status: "new",
    });
  });
});
