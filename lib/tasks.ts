import { z } from "zod";
import { ALLERGEN_CODES, DIET_CODES } from "@/lib/allergens";
import type { Menu } from "@/lib/schema";

// Output schemas for the two model tasks. Strict objects, so a reply with
// unknown fields fails validation instead of being silently stripped. Dish and
// ingredient ids are enums of the menu's own ids (CLAUDE.md rule 2).

function idEnum(ids: string[]) {
  return z.enum(ids as [string, ...string[]]);
}

export function personalizeOutputSchema(dishIds: string[]) {
  return z.strictObject({
    dishes: z.array(
      z.strictObject({
        dishId: idEnum(dishIds),
        localizedName: z.string().min(1).max(120),
        explanation: z.string().min(1).max(400),
      }),
    ),
  });
}

export function orderOutputSchema(menu: Menu) {
  return z.strictObject({
    items: z
      .array(
        z.strictObject({
          dishId: idEnum(menu.dishes.map((dish) => dish.id)),
          qty: z.int().min(1).max(10),
          forWhom: z.string().max(80).optional(),
          noteOriginal: z.string().max(300).optional(),
          noteItalian: z.string().max(300).optional(),
        }),
      )
      .max(20),
    extractedConstraints: z.strictObject({
      allergens: z.array(z.enum(ALLERGEN_CODES)),
      diets: z.array(z.enum(DIET_CODES)),
      excludedIngredientIds: z.array(idEnum(menu.ingredients.map((ingredient) => ingredient.id))),
    }),
    unmatchedRequests: z.array(z.string().max(200)),
    clarifyingQuestion: z.string().max(300).optional(),
  });
}

export type PersonalizeOutput = z.infer<ReturnType<typeof personalizeOutputSchema>>;
export type OrderOutput = z.infer<ReturnType<typeof orderOutputSchema>>;
