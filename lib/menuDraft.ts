import { z } from "zod";
import { ALLERGEN_CODES, TAG_CODES, type AllergenCode } from "@/lib/allergens";
import { CATEGORIES, Id, MenuSchema, type Menu } from "@/lib/schema";

// A menu drafted by the model from the restaurant's own menu text, for the
// owner to check in /admin/import. Every allergen here is a suggestion until the
// owner approves the dish; unapproved dishes never pass the gate for a diner
// with any allergy or diet (CLAUDE.md rule 4).

export const MenuDraftSchema = z
  .strictObject({
    ingredients: z
      .array(
        z.strictObject({
          id: Id,
          it: z.string().min(1).max(80),
          en: z.string().min(1).max(80),
          allergens: z.array(z.enum(ALLERGEN_CODES)),
          tags: z.array(z.enum(TAG_CODES)),
        }),
      )
      .max(200),
    dishes: z
      .array(
        z.strictObject({
          id: Id,
          category: z.enum(CATEGORIES),
          nameIt: z.string().min(1).max(120),
          descriptionIt: z.string().min(1).max(300),
          priceEur: z.number().positive().nullable(),
          ingredientIds: z.array(Id).max(20),
        }),
      )
      .min(1)
      .max(80),
  })
  .superRefine((draft, ctx) => {
    const ingredientIds = new Set(draft.ingredients.map((ingredient) => ingredient.id));
    if (ingredientIds.size !== draft.ingredients.length) ctx.addIssue({ code: "custom", message: "ingredient ids must be unique" });
    if (new Set(draft.dishes.map((dish) => dish.id)).size !== draft.dishes.length) {
      ctx.addIssue({ code: "custom", message: "dish ids must be unique" });
    }
    draft.dishes.forEach((dish, i) =>
      dish.ingredientIds.forEach((id, j) => {
        if (!ingredientIds.has(id)) {
          ctx.addIssue({ code: "custom", path: ["dishes", i, "ingredientIds", j], message: `"${id}" is not in ingredients[]` });
        }
      }),
    );
  });

export type MenuDraft = z.infer<typeof MenuDraftSchema>;
export type DraftIngredient = MenuDraft["ingredients"][number];
export type EditorDish = MenuDraft["dishes"][number] & { ownerApproved: boolean };
export type Restaurant = { id: string; name: string; city: string };
export type EditorState = { restaurant: Restaurant; ingredients: DraftIngredient[]; dishes: EditorDish[] };

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = slugify(base) || "item";
  let id = root;
  for (let n = 2; used.has(id); n++) id = `${root}_${n}`;
  return id;
}

// Nothing is approved until the owner ticks it.
export function startEditing(draft: MenuDraft, restaurant: Restaurant): EditorState {
  return { restaurant, ingredients: draft.ingredients, dishes: draft.dishes.map((dish) => ({ ...dish, ownerApproved: false })) };
}

// Changing an ingredient's allergens or tags withdraws approval from every dish that uses it.
export function updateIngredient(state: EditorState, id: string, patch: Partial<Omit<DraftIngredient, "id">>): EditorState {
  const changesFacts = patch.allergens !== undefined || patch.tags !== undefined;
  return {
    ...state,
    ingredients: state.ingredients.map((ingredient) => (ingredient.id === id ? { ...ingredient, ...patch } : ingredient)),
    dishes: changesFacts
      ? state.dishes.map((dish) => (dish.ingredientIds.includes(id) ? { ...dish, ownerApproved: false } : dish))
      : state.dishes,
  };
}

// Changing what a dish contains withdraws its approval; name, text and price do not.
export function updateDish(state: EditorState, id: string, patch: Partial<Omit<EditorDish, "id">>): EditorState {
  return {
    ...state,
    dishes: state.dishes.map((dish) => {
      if (dish.id !== id) return dish;
      const next = { ...dish, ...patch };
      return patch.ingredientIds !== undefined && patch.ownerApproved === undefined ? { ...next, ownerApproved: false } : next;
    }),
  };
}

export function dishDraftAllergens(state: EditorState, dish: EditorDish): AllergenCode[] {
  const present = new Set(
    dish.ingredientIds.flatMap((id) => state.ingredients.find((ingredient) => ingredient.id === id)?.allergens ?? []),
  );
  return ALLERGEN_CODES.filter((code) => present.has(code));
}

// An ingredient's allergens stay marked as a draft until every dish using it is approved.
export function ingredientConfirmed(state: EditorState, id: string): boolean {
  const users = state.dishes.filter((dish) => dish.ingredientIds.includes(id));
  return users.length > 0 && users.every((dish) => dish.ownerApproved);
}

export function toMenu(state: EditorState): { menu: Menu | null; errors: string[] } {
  const used = new Set(state.dishes.flatMap((dish) => dish.ingredientIds));
  const candidate = {
    restaurant: { id: state.restaurant.id, name: state.restaurant.name.trim(), city: state.restaurant.city.trim() },
    ingredients: state.ingredients
      .filter((ingredient) => used.has(ingredient.id))
      .map((ingredient) => ({
        id: ingredient.id,
        name: { it: ingredient.it.trim(), en: ingredient.en.trim() },
        allergens: ingredient.allergens,
        tags: ingredient.tags,
      })),
    dishes: state.dishes.map((dish) => ({
      id: dish.id,
      category: dish.category,
      nameIt: dish.nameIt.trim(),
      descriptionIt: dish.descriptionIt.trim(),
      priceEur: dish.priceEur,
      ingredientIds: dish.ingredientIds,
      ownerApproved: dish.ownerApproved,
    })),
  };
  const parsed = MenuSchema.safeParse(candidate);
  if (parsed.success) return { menu: parsed.data, errors: [] };
  return {
    menu: null,
    errors: parsed.error.issues.map((issue) => {
      const [section, index, field] = issue.path;
      if (section === "dishes" && typeof index === "number") {
        return `${state.dishes[index]?.nameIt || `Dish ${index + 1}`}: ${field === "priceEur" ? "price is missing" : `${String(field ?? "")} ${issue.message}`.trim()}`;
      }
      if (section === "restaurant") return `Restaurant ${String(index)}: ${issue.message}`;
      return `${issue.path.join(".")}: ${issue.message}`;
    }),
  };
}
