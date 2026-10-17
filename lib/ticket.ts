import { ALLERGEN_NAMES, DIET_NAMES } from "@/lib/allergens";
import { checkDish, dishAllergens } from "@/lib/gate";
import { KITCHEN, childAge, fillTemplate, mentionsChild, type Lang } from "@/lib/i18n";
import type { OrderLine } from "@/lib/order";
import type { DinerProfile, Menu } from "@/lib/schema";

export type TicketStatus = "new" | "confirmed" | "to_clarify";

export type TicketItem = {
  nameIt: string;
  qty: number;
  forWhom?: string;
  noteItalian?: string;
  allergenFlagsIt: string[];
};

export type Ticket = {
  ticketId: string;
  table: string;
  createdAt: string;
  dinerLang: Lang;
  partySize: number;
  items: TicketItem[];
  dinerAllergiesIt: string[];
  dinerDietsIt: string[];
  dinerExcludedIt: string[];
  status: TicketStatus;
};

// The kitchen reads Italian: a child is labelled in Italian, anything else is
// shown as the diner wrote it.
function kitchenForWhom(forWhom: string | undefined): string | undefined {
  if (!forWhom) return undefined;
  if (!mentionsChild(forWhom)) return forWhom;
  const age = childAge(forWhom);
  return age ? fillTemplate(KITCHEN.childAge, { age }) : KITCHEN.child;
}

// Every line is checked by the gate once more; a blocked line never reaches the kitchen.
export function buildTicket(args: {
  menu: Menu;
  profile: DinerProfile;
  lines: OrderLine[];
  table: string;
  partySize: number;
  ticketId: string;
  createdAt: string;
}): Ticket {
  const { menu, profile } = args;
  const dishes = new Map(menu.dishes.map((dish) => [dish.id, dish]));
  const items: TicketItem[] = [];
  for (const line of args.lines) {
    const dish = dishes.get(line.dishId);
    if (!dish || !checkDish(dish, profile, menu).allowed) continue;
    items.push({
      nameIt: dish.nameIt,
      qty: line.qty,
      ...(line.forWhom ? { forWhom: kitchenForWhom(line.forWhom) } : {}),
      ...(line.noteItalian ? { noteItalian: line.noteItalian } : {}),
      allergenFlagsIt: dishAllergens(dish, menu).map((code) => ALLERGEN_NAMES[code].it),
    });
  }
  const ingredients = new Map(menu.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return {
    ticketId: args.ticketId,
    table: args.table,
    createdAt: args.createdAt,
    dinerLang: profile.lang,
    partySize: args.partySize,
    items,
    dinerAllergiesIt: profile.allergens.map((code) => ALLERGEN_NAMES[code].it),
    dinerDietsIt: profile.diets.map((code) => DIET_NAMES[code].it),
    dinerExcludedIt: profile.excludedIngredientIds.map((id) => ingredients.get(id)?.name.it ?? id),
    status: "new",
  };
}
