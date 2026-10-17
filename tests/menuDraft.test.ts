import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDish } from "@/lib/gate";
import { draftMenu, passcodeOk } from "@/lib/importMenu";
import { MenuDraftSchema, ingredientConfirmed, startEditing, toMenu, updateDish, updateIngredient } from "@/lib/menuDraft";
import { mockMenuDraft } from "@/lib/mocks";
import { DinerProfileSchema } from "@/lib/schema";

const TEN_DISHES = `ANTIPASTI
Bruschetta al pomodoro (pane, pomodoro, aglio, olio) 6
Fiori di zucca fritti (fiori di zucca, mozzarella, alici, farina) 8
PRIMI
Spaghetti alle vongole (spaghetti, vongole, aglio, vino bianco, prezzemolo) €15
Fettuccine al ragù (fettuccine all'uovo, manzo, pomodoro, sedano, carota, cipolla) 13,50
Risotto ai funghi (riso, funghi porcini, burro, parmigiano, vino bianco) 14 €
SECONDI
Pollo alla romana (pollo, peperoni, pomodoro, vino bianco) 16
Saltimbocca (vitello, prosciutto crudo, salvia, burro) 17
Baccalà fritto (baccalà, farina, olio) 15
CONTORNI
Patate al forno (patate, rosmarino, olio) 5
DOLCI
Panna cotta ai frutti di bosco (panna, zucchero, gelatina, frutti di bosco) 6`;

const restaurant = { id: "trattoria-test", name: "Trattoria Test", city: "Roma" };

afterEach(() => vi.unstubAllEnvs());

describe("menu import mock", () => {
  it("reads a 10-dish menu with categories, prices and suggested allergens", () => {
    const draft = MenuDraftSchema.parse(mockMenuDraft(TEN_DISHES));
    expect(draft.dishes).toHaveLength(10);
    expect(draft.dishes.map((dish) => dish.category)).toEqual([
      "antipasti", "antipasti", "primi", "primi", "primi", "secondi", "secondi", "secondi", "contorni", "dolci",
    ]);
    expect(draft.dishes[3]).toMatchObject({ nameIt: "Fettuccine al ragù", priceEur: 13.5 });
    const facts = (id: string) => draft.ingredients.find((ingredient) => ingredient.id === id);
    expect(facts("fettuccine_all_uovo")?.allergens).toEqual(["gluten", "eggs"]);
    expect(facts("vongole")).toMatchObject({ allergens: ["molluscs"], tags: ["fish_seafood"] });
    expect(facts("prosciutto_crudo")?.tags).toEqual(["pork", "meat"]);
    expect(facts("gelatina")?.tags).toEqual(["pork", "meat"]);
  });

  it("drafts through generateJSON with MOCK_LLM=1", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    const { draft, meta } = await draftMenu(TEN_DISHES);
    expect(draft.dishes).toHaveLength(10);
    expect(meta.servedFrom).toBe("mock");
  });
});

describe("draft schema", () => {
  it("rejects a dish that points at an ingredient that is not listed", () => {
    const draft = mockMenuDraft(TEN_DISHES);
    draft.dishes[0].ingredientIds.push("tartufo");
    expect(MenuDraftSchema.safeParse(draft).success).toBe(false);
  });
});

describe("owner approval", () => {
  const draft = mockMenuDraft(TEN_DISHES);

  it("starts with nothing approved", () => {
    const state = startEditing(draft, restaurant);
    expect(state.dishes.every((dish) => !dish.ownerApproved)).toBe(true);
    expect(ingredientConfirmed(state, "burro")).toBe(false);
  });

  it("withdraws approval when an ingredient's allergens change", () => {
    let state = startEditing(draft, restaurant);
    for (const dish of state.dishes) state = updateDish(state, dish.id, { ownerApproved: true });
    expect(ingredientConfirmed(state, "burro")).toBe(true);

    state = updateIngredient(state, "burro", { allergens: [] });
    const usesButter = state.dishes.filter((dish) => dish.ingredientIds.includes("burro"));
    expect(usesButter.map((dish) => dish.nameIt)).toEqual(["Risotto ai funghi", "Saltimbocca"]);
    expect(usesButter.every((dish) => !dish.ownerApproved)).toBe(true);
    expect(state.dishes.find((dish) => dish.nameIt === "Patate al forno")?.ownerApproved).toBe(true);

    state = updateIngredient(state, "patate", { en: "potatoes" });
    expect(state.dishes.find((dish) => dish.nameIt === "Patate al forno")?.ownerApproved).toBe(true);
  });

  it("withdraws approval when a dish's ingredients change, not its name or price", () => {
    let state = startEditing(draft, restaurant);
    const id = state.dishes[0].id;
    state = updateDish(state, id, { ownerApproved: true });
    state = updateDish(state, id, { nameIt: "Bruschetta classica", priceEur: 7 });
    expect(state.dishes[0].ownerApproved).toBe(true);
    state = updateDish(state, id, { ingredientIds: ["pane", "pomodoro"] });
    expect(state.dishes[0].ownerApproved).toBe(false);
  });
});

describe("toMenu", () => {
  it("builds a valid menu where only approved dishes pass the gate for a diner with an allergy", () => {
    let state = startEditing(mockMenuDraft(TEN_DISHES), restaurant);
    const [bruschetta, fiori] = state.dishes;
    state = updateDish(state, bruschetta.id, { ownerApproved: true });
    const { menu, errors } = toMenu(state);
    expect(errors).toEqual([]);
    expect(menu?.restaurant).toEqual(restaurant);
    const diner = DinerProfileSchema.parse({ lang: "en", audience: "dietary", allergens: ["peanuts"] });
    const dish = (id: string) => menu!.dishes.find((d) => d.id === id)!;
    expect(checkDish(dish(bruschetta.id), diner, menu!).allowed).toBe(true);
    expect(checkDish(dish(fiori.id), diner, menu!).reasons).toEqual([{ kind: "unverified", code: "unverified" }]);
  });

  it("lists what is missing instead of exporting a broken menu", () => {
    let state = startEditing(mockMenuDraft(TEN_DISHES), restaurant);
    state = updateDish(state, state.dishes[2].id, { priceEur: null });
    const { menu, errors } = toMenu({ ...state, restaurant: { ...restaurant, name: " " } });
    expect(menu).toBeNull();
    expect(errors).toContain("Spaghetti alle vongole: price is missing");
    expect(errors.some((error) => error.startsWith("Restaurant name"))).toBe(true);
  });

  it("drops ingredients no dish uses", () => {
    let state = startEditing(mockMenuDraft(TEN_DISHES), restaurant);
    state = { ...state, ingredients: [...state.ingredients, { id: "tartufo", it: "tartufo", en: "truffle", allergens: [], tags: [] }] };
    expect(toMenu(state).menu?.ingredients.some((ingredient) => ingredient.id === "tartufo")).toBe(false);
  });
});

describe("admin passcode", () => {
  it("is closed when ADMIN_PASSCODE is not set", () => {
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect(passcodeOk("")).toBe(false);
  });

  it("accepts only the exact passcode", () => {
    vi.stubEnv("ADMIN_PASSCODE", "cacio-e-pepe");
    expect(passcodeOk("cacio-e-pepe")).toBe(true);
    expect(passcodeOk("cacio-e-pep")).toBe(false);
    expect(passcodeOk(undefined)).toBe(false);
  });
});
