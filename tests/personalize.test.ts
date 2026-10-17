import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import demo from "@/data/demo-trattoria.json";
import { findClaim } from "@/lib/claimGuard";
import { partitionMenu } from "@/lib/gate";
import { LANGS } from "@/lib/i18n";
import { mockPersonalize } from "@/lib/mocks";
import { personalizeMenu } from "@/lib/personalize";
import { AUDIENCES, DinerProfileSchema, MenuSchema } from "@/lib/schema";

const menu = MenuSchema.parse(demo);
let fetchMock: ReturnType<typeof vi.fn>;

// Answers like the model: one entry per requested dish, with a claim for the dishes in `claims`.
function fakeModel(claims: { first: string[]; retry: string[] }) {
  return async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { messages: { content: string }[] };
    const retry = body.messages[0].content.includes("was rejected");
    const { dishes } = JSON.parse(body.messages[1].content) as { dishes: { id: string }[] };
    const claimed = retry ? claims.retry : claims.first;
    const content = JSON.stringify({
      dishes: dishes.map((dish) => ({
        dishId: dish.id,
        localizedName: `name ${dish.id}`,
        explanation: claimed.includes(dish.id) ? "A gluten-free Roman classic." : "A Roman classic.",
      })),
    });
    return new Response(
      JSON.stringify({
        id: "c",
        object: "chat.completion",
        created: 0,
        model: "google/gemma-4-26B-A4B-it",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 300, completion_tokens: 80, total_tokens: 380 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
}

beforeEach(() => {
  vi.stubEnv("MOCK_LLM", "0");
  vi.stubEnv("LLM_BASE_URL", "http://gpu.test:8000/v1");
  vi.stubEnv("LLM_API_KEY", "test-key");
  vi.stubEnv("CACHE_WRITE", "0");
  vi.stubEnv("CACHE_DIR", "/nonexistent-menubridge-cache");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("claim guard", () => {
  it.each([
    "A naturally gluten-free dish.",
    "Piatto senza glutine.",
    "Glutenfrei und lecker.",
    "Un plat sans gluten.",
    "Perfect for vegans and vegetarians.",
    "Safe for children.",
    "グルテンフリーのパスタです。",
    "安心して召し上がれます。",
    "这道菜不含麸质。",
    "Блюдо без глютена.",
  ])("rejects %s", (text) => {
    expect(findClaim(text)).not.toBeNull();
  });

  it("accepts a plain description", () => {
    expect(findClaim("Spaghetti with crisp cured pork cheek, egg yolk and pecorino.")).toBeNull();
  });

  it.each(LANGS)("finds no claims in the %s mocks", (lang) => {
    for (const audience of AUDIENCES) {
      for (const dish of mockPersonalize(menu, menu.dishes, { lang, audience }).dishes) {
        expect(findClaim(dish.localizedName, dish.explanation), `${lang} ${audience} ${dish.dishId}`).toBeNull();
      }
    }
  });
});

describe("personalizeMenu", () => {
  it("makes one call per category and covers every dish with MOCK_LLM=1", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    const response = await personalizeMenu(menu, { lang: "ja", audience: "first_timer" });
    expect(response.calls).toHaveLength(5);
    expect(Object.keys(response.dishes).sort()).toEqual(menu.dishes.map((dish) => dish.id).sort());
    expect(response.dishes.carbonara).toEqual({
      localizedName: "スパゲッティ・アッラ・カルボナーラ",
      explanation: expect.stringContaining("ローマ"),
      aiGenerated: true,
    });
    expect(response.meta).toMatchObject({ servedFrom: "mock", qualityRejections: 0, gpu: "AMD Instinct MI300X" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("regenerates a dish whose text makes a claim, once", async () => {
    fetchMock.mockImplementation(fakeModel({ first: ["carbonara"], retry: [] }));
    const response = await personalizeMenu(menu, { lang: "en", audience: "foodie" });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(response.dishes.carbonara).toEqual({ localizedName: "name carbonara", explanation: "A Roman classic.", aiGenerated: true });
    expect(response.meta?.qualityRejections).toBe(1);
    expect(response.calls).toHaveLength(6);
  });

  it("falls back to the Italian description when the retry still makes a claim", async () => {
    fetchMock.mockImplementation(fakeModel({ first: ["carbonara"], retry: ["carbonara"] }));
    const response = await personalizeMenu(menu, { lang: "en", audience: "foodie" });
    const carbonara = menu.dishes.find((dish) => dish.id === "carbonara");
    expect(response.dishes.carbonara).toEqual({
      localizedName: carbonara?.nameIt,
      explanation: carbonara?.descriptionIt,
      aiGenerated: false,
    });
    expect(response.meta?.qualityRejections).toBe(2);
  });

  it("shows the Italian menu when the model is unreachable and nothing is cached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const response = await personalizeMenu(menu, { lang: "de", audience: "family" });
    expect(response.unavailable).toBe(true);
    expect(response.meta).toBeNull();
    expect(Object.values(response.dishes).every((copy) => !copy.aiGenerated)).toBe(true);
  });
});

describe("partitionMenu", () => {
  it("never puts carbonara in the main list for a no_pork diner", () => {
    const profile = DinerProfileSchema.parse({ lang: "ja", audience: "first_timer", diets: ["no_pork"] });
    const { allowed, blocked } = partitionMenu(menu, profile);
    expect(allowed.map((dish) => dish.id)).not.toContain("carbonara");
    expect(blocked.find((entry) => entry.dish.id === "carbonara")?.reasons).toEqual([
      { kind: "diet", code: "pork", ingredientId: "guanciale" },
    ]);
  });
});
