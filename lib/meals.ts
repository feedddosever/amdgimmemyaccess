import type { AllergenCode } from "@/lib/allergens";
import { readJSON, writeJSON } from "@/lib/channel";
import { checkDish, dishAllergens } from "@/lib/gate";
import { ingredientName, type Lang } from "@/lib/i18n";
import type { OrderLine } from "@/lib/order";
import type { DinerProfile, Menu } from "@/lib/schema";

// "My meals": the diner's own record of what they ate, for a doctor if they react.
// Built only from the owner-approved ingredient sheet at the moment of ordering,
// never from the model (CLAUDE.md rule 1). It stays in this browser.

export type MealDish = {
  nameIt: string;
  qty: number;
  forWhom?: string;
  // Each ingredient in Italian and in the diner's language.
  ingredients: { it: string; local: string }[];
  allergens: AllergenCode[];
  ownerApproved: boolean;
};

export type Meal = {
  mealId: string;
  createdAt: string;
  restaurantName: string;
  table: string;
  lang: Lang;
  dishes: MealDish[];
};

const KEY = "menubridge:meals";
const MAX_MEALS = 50;

// Only the lines that pass the gate, exactly like the kitchen ticket.
export function buildMeal(args: {
  menu: Menu;
  profile: DinerProfile;
  lines: OrderLine[];
  table: string;
  mealId: string;
  createdAt: string;
}): Meal {
  const { menu, profile } = args;
  const dishes = new Map(menu.dishes.map((dish) => [dish.id, dish]));
  const ingredients = new Map(menu.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const mealDishes: MealDish[] = [];
  for (const line of args.lines) {
    const dish = dishes.get(line.dishId);
    if (!dish || !checkDish(dish, profile, menu).allowed) continue;
    mealDishes.push({
      nameIt: dish.nameIt,
      qty: line.qty,
      ...(line.forWhom ? { forWhom: line.forWhom } : {}),
      ingredients: dish.ingredientIds.flatMap((id) => {
        const ingredient = ingredients.get(id);
        return ingredient ? [{ it: ingredient.name.it, local: ingredientName(ingredient, profile.lang) }] : [];
      }),
      allergens: dishAllergens(dish, menu),
      ownerApproved: dish.ownerApproved,
    });
  }
  return {
    mealId: args.mealId,
    createdAt: args.createdAt,
    restaurantName: menu.restaurant.name,
    table: args.table,
    lang: profile.lang,
    dishes: mealDishes,
  };
}

export function loadMeals(): Meal[] {
  const meals = readJSON<unknown>(KEY, []);
  return Array.isArray(meals) ? (meals as Meal[]) : [];
}

export function storeMeal(meal: Meal) {
  if (meal.dishes.length === 0) return;
  writeJSON(KEY, [meal, ...loadMeals()].slice(0, MAX_MEALS));
}

export function clearMeals() {
  writeJSON(KEY, []);
}
