import { describe, expect, it } from "vitest";
import demo from "@/data/demo-trattoria.json";
import { buildMeal } from "@/lib/meals";
import { DinerProfileSchema, MenuSchema, type DinerProfile } from "@/lib/schema";

const menu = MenuSchema.parse(demo);

function profile(overrides: Partial<DinerProfile> = {}): DinerProfile {
  return DinerProfileSchema.parse({ lang: "ja", audience: "first_timer", ...overrides });
}

function meal(lines: { dishId: string; qty: number; forWhom?: string }[], diner = profile()) {
  return buildMeal({ menu, profile: diner, lines, table: "7", mealId: "m1", createdAt: "2026-10-18T10:00:00.000Z" });
}

describe("buildMeal", () => {
  it("records each dish with its ingredients in Italian and the diner's language", () => {
    const [dish] = meal([{ dishId: "cacio_e_pepe", qty: 1, forWhom: "6歳の子ども" }]).dishes;
    expect(dish.nameIt).toBe("Tonnarelli cacio e pepe");
    expect(dish.forWhom).toBe("6歳の子ども");
    expect(dish.ingredients).toContainEqual({ it: "pecorino romano", local: "ペコリーノ・ロマーノ" });
    expect(dish.ingredients).toContainEqual({ it: "pepe nero", local: "黒こしょう" });
  });

  it("takes allergens from the ingredient sheet, not from any model", () => {
    const [dish] = meal([{ dishId: "cacio_e_pepe", qty: 1 }]).dishes;
    expect(dish.allergens).toEqual(["gluten", "milk"]);
    expect(dish.ownerApproved).toBe(true);
  });

  it("keeps out a dish the gate blocks, exactly like the kitchen ticket", () => {
    const record = meal(
      [
        { dishId: "carbonara", qty: 1 },
        { dishId: "cacio_e_pepe", qty: 1 },
      ],
      profile({ diets: ["no_pork"] }),
    );
    expect(record.dishes.map((dish) => dish.nameIt)).toEqual(["Tonnarelli cacio e pepe"]);
  });

  it("marks a dish the owner has not approved", () => {
    const unapproved = menu.dishes.find((dish) => !dish.ownerApproved);
    expect(unapproved).toBeDefined();
    const [dish] = meal([{ dishId: unapproved!.id, qty: 1 }]).dishes;
    expect(dish.ownerApproved).toBe(false);
  });

  it("ignores dish IDs that are not on the menu", () => {
    expect(meal([{ dishId: "not_a_dish", qty: 1 }]).dishes).toEqual([]);
  });

  it("records the restaurant, table and language", () => {
    const record = meal([{ dishId: "tiramisu", qty: 2 }]);
    expect(record).toMatchObject({ restaurantName: menu.restaurant.name, table: "7", lang: "ja", mealId: "m1" });
    expect(record.dishes[0].qty).toBe(2);
  });
});
