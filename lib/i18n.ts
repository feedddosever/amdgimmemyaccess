import { ALLERGEN_NAMES, TAG_NAMES, isAllergenCode } from "@/lib/allergens";
import type { GateReason } from "@/lib/gate";
import type { Ingredient, Menu } from "@/lib/schema";

export const LANGS = ["it", "en", "de", "fr", "es", "ja", "zh", "ru"] as const;
export type Lang = (typeof LANGS)[number];

// Gate reasons are always built from these templates, never from model text.
type ReasonTemplates = Record<GateReason["kind"], string>;

export const REASON_TEMPLATES: Record<Lang, ReasonTemplates> = {
  it: {
    allergen: "Contiene {ingredient} ({allergen})",
    diet: "Contiene {ingredient} ({tag})",
    excluded: "Contiene {ingredient}, che hai chiesto di escludere",
    unverified: "Il ristorante non ha ancora confermato gli allergeni di questo piatto",
  },
  en: {
    allergen: "Contains {ingredient} ({allergen})",
    diet: "Contains {ingredient} ({tag})",
    excluded: "Contains {ingredient}, which you asked to leave out",
    unverified: "The restaurant has not confirmed this dish's allergens yet",
  },
  de: {
    allergen: "Enthält {ingredient} ({allergen})",
    diet: "Enthält {ingredient} ({tag})",
    excluded: "Enthält {ingredient} – Sie möchten das weglassen",
    unverified: "Das Restaurant hat die Allergene dieses Gerichts noch nicht bestätigt",
  },
  fr: {
    allergen: "Contient {ingredient} ({allergen})",
    diet: "Contient {ingredient} ({tag})",
    excluded: "Contient {ingredient}, que vous avez demandé d'éviter",
    unverified: "Le restaurant n'a pas encore confirmé les allergènes de ce plat",
  },
  es: {
    allergen: "Contiene {ingredient} ({allergen})",
    diet: "Contiene {ingredient} ({tag})",
    excluded: "Contiene {ingredient}, que pediste evitar",
    unverified: "El restaurante aún no ha confirmado los alérgenos de este plato",
  },
  ja: {
    allergen: "{ingredient}（{allergen}）を含みます",
    diet: "{ingredient}（{tag}）を含みます",
    excluded: "除外をご希望の{ingredient}を含みます",
    unverified: "この料理のアレルゲン情報は、まだ店舗で確認されていません",
  },
  zh: {
    allergen: "含有{ingredient}（{allergen}）",
    diet: "含有{ingredient}（{tag}）",
    excluded: "含有您要求避免的{ingredient}",
    unverified: "餐厅尚未确认这道菜的过敏原信息",
  },
  ru: {
    allergen: "Содержит {ingredient} ({allergen})",
    diet: "Содержит {ingredient} ({tag})",
    excluded: "Содержит {ingredient} — вы просили это исключить",
    unverified: "Ресторан ещё не подтвердил аллергены этого блюда",
  },
};

// Shown on every dish with ownerApproved=false.
export const ASK_STAFF: Record<Lang, string> = {
  it: "Chiedi al personale informazioni sugli allergeni",
  en: "Ask staff about allergens",
  de: "Fragen Sie das Personal nach Allergenen",
  fr: "Renseignez-vous auprès du personnel sur les allergènes",
  es: "Pregunta al personal por los alérgenos",
  ja: "アレルゲンについてはスタッフにお尋ねください",
  zh: "过敏原信息请咨询店员",
  ru: "Об аллергенах спросите у персонала",
};

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

// The ingredient sheet has Italian and English names; every other language uses English.
export function ingredientName(ingredient: Ingredient, lang: Lang): string {
  return lang === "it" ? ingredient.name.it : ingredient.name.en;
}

export function formatReason(reason: GateReason, lang: Lang, menu: Menu): string {
  const templates = REASON_TEMPLATES[lang];
  if (reason.kind === "unverified") return templates.unverified;

  const ingredient = menu.ingredients.find((candidate) => candidate.id === reason.ingredientId);
  const name = ingredient ? ingredientName(ingredient, lang) : reason.ingredientId;

  switch (reason.kind) {
    case "allergen":
      return fillTemplate(templates.allergen, { ingredient: name, allergen: ALLERGEN_NAMES[reason.code][lang] });
    case "diet": {
      const tag = isAllergenCode(reason.code) ? ALLERGEN_NAMES[reason.code][lang] : TAG_NAMES[reason.code][lang];
      return fillTemplate(templates.diet, { ingredient: name, tag });
    }
    case "excluded":
      return fillTemplate(templates.excluded, { ingredient: name });
  }
}
