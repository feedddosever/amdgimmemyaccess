import { z } from "zod";
import { ALLERGEN_CODES, DIET_CODES, TAG_CODES } from "@/lib/allergens";
import { LANGS } from "@/lib/i18n";

// Lowercase ids, safe in URLs and as JSON-schema enum values.
export const Id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

export const CATEGORIES = ["antipasti", "primi", "secondi", "contorni", "dolci"] as const;
export const AUDIENCES = ["first_timer", "foodie", "family", "dietary"] as const;

// Italian and English names are required. The other diner languages are optional and
// fall back to English, so a menu drafted in /admin/import works before it is translated.
const OptionalName = z.string().min(1).optional();

export const IngredientSchema = z.object({
  id: Id,
  name: z.object({
    it: z.string().min(1),
    en: z.string().min(1),
    de: OptionalName,
    fr: OptionalName,
    es: OptionalName,
    ja: OptionalName,
    zh: OptionalName,
    ru: OptionalName,
  }),
  allergens: z.array(z.enum(ALLERGEN_CODES)),
  tags: z.array(z.enum(TAG_CODES)),
});

export const DishSchema = z.object({
  id: Id,
  category: z.enum(CATEGORIES),
  nameIt: z.string().min(1),
  descriptionIt: z.string().min(1),
  priceEur: z.number().positive(),
  ingredientIds: z.array(Id),
  ownerApproved: z.boolean(),
  kidFriendly: z.boolean().optional(),
});

export const MenuSchema = z
  .object({
    restaurant: z.object({
      id: Id,
      name: z.string().min(1),
      city: z.string().min(1),
      demoData: z.boolean().optional(),
    }),
    ingredients: z.array(IngredientSchema),
    dishes: z.array(DishSchema),
  })
  .superRefine((menu, ctx) => {
    // A dish pointing at a missing ingredient would silently lose its allergens.
    const ingredientIds = new Set<string>();
    menu.ingredients.forEach((ingredient, i) => {
      if (ingredientIds.has(ingredient.id)) {
        ctx.addIssue({ code: "custom", path: ["ingredients", i, "id"], message: `duplicate ingredient id "${ingredient.id}"` });
      }
      ingredientIds.add(ingredient.id);
    });
    const dishIds = new Set<string>();
    menu.dishes.forEach((dish, i) => {
      if (dishIds.has(dish.id)) {
        ctx.addIssue({ code: "custom", path: ["dishes", i, "id"], message: `duplicate dish id "${dish.id}"` });
      }
      dishIds.add(dish.id);
      dish.ingredientIds.forEach((id, j) => {
        if (!ingredientIds.has(id)) {
          ctx.addIssue({ code: "custom", path: ["dishes", i, "ingredientIds", j], message: `unknown ingredient id "${id}"` });
        }
      });
    });
  });

export const DinerProfileSchema = z.object({
  lang: z.enum(LANGS),
  audience: z.enum(AUDIENCES),
  allergens: z.array(z.enum(ALLERGEN_CODES)).default([]),
  diets: z.array(z.enum(DIET_CODES)).default([]),
  excludedIngredientIds: z.array(Id).default([]),
});

export type Ingredient = z.infer<typeof IngredientSchema>;
export type Dish = z.infer<typeof DishSchema>;
export type Menu = z.infer<typeof MenuSchema>;
export type DinerProfile = z.infer<typeof DinerProfileSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Audience = (typeof AUDIENCES)[number];
