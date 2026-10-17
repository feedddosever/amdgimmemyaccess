import type { Lang } from "@/lib/i18n";

// The 14 allergens of Regulation (EU) No 1169/2011, Annex II, in Annex order.
export const ALLERGEN_CODES = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;
export type AllergenCode = (typeof ALLERGEN_CODES)[number];

// Ingredient tags that diets are checked against.
export const TAG_CODES = [
  "pork",
  "beef",
  "veal",
  "lamb",
  "poultry",
  "meat",
  "fish_seafood",
  "alcohol",
] as const;
export type TagCode = (typeof TAG_CODES)[number];

export const DIET_CODES = ["vegetarian", "vegan", "no_pork", "no_beef", "no_alcohol"] as const;
export type DietCode = (typeof DIET_CODES)[number];

type Names = Record<Lang, string>;

export const ALLERGEN_NAMES: Record<AllergenCode, Names> = {
  gluten: { it: "glutine", en: "gluten", de: "Gluten", fr: "gluten", es: "gluten", ja: "グルテン", zh: "麸质", ru: "глютен" },
  crustaceans: { it: "crostacei", en: "crustaceans", de: "Krebstiere", fr: "crustacés", es: "crustáceos", ja: "甲殻類", zh: "甲壳类", ru: "ракообразные" },
  eggs: { it: "uova", en: "eggs", de: "Eier", fr: "œufs", es: "huevos", ja: "卵", zh: "蛋类", ru: "яйца" },
  fish: { it: "pesce", en: "fish", de: "Fisch", fr: "poisson", es: "pescado", ja: "魚", zh: "鱼类", ru: "рыба" },
  peanuts: { it: "arachidi", en: "peanuts", de: "Erdnüsse", fr: "arachides", es: "cacahuetes", ja: "落花生", zh: "花生", ru: "арахис" },
  soy: { it: "soia", en: "soy", de: "Soja", fr: "soja", es: "soja", ja: "大豆", zh: "大豆", ru: "соя" },
  milk: { it: "latte", en: "milk", de: "Milch", fr: "lait", es: "leche", ja: "乳", zh: "奶类", ru: "молоко" },
  nuts: { it: "frutta a guscio", en: "tree nuts", de: "Schalenfrüchte", fr: "fruits à coque", es: "frutos de cáscara", ja: "木の実", zh: "坚果", ru: "орехи" },
  celery: { it: "sedano", en: "celery", de: "Sellerie", fr: "céleri", es: "apio", ja: "セロリ", zh: "芹菜", ru: "сельдерей" },
  mustard: { it: "senape", en: "mustard", de: "Senf", fr: "moutarde", es: "mostaza", ja: "マスタード", zh: "芥末", ru: "горчица" },
  sesame: { it: "sesamo", en: "sesame", de: "Sesam", fr: "sésame", es: "sésamo", ja: "ごま", zh: "芝麻", ru: "кунжут" },
  sulphites: { it: "solfiti", en: "sulphites", de: "Sulfite", fr: "sulfites", es: "sulfitos", ja: "亜硫酸塩", zh: "亚硫酸盐", ru: "сульфиты" },
  lupin: { it: "lupini", en: "lupin", de: "Lupinen", fr: "lupin", es: "altramuces", ja: "ルピナス", zh: "羽扇豆", ru: "люпин" },
  molluscs: { it: "molluschi", en: "molluscs", de: "Weichtiere", fr: "mollusques", es: "moluscos", ja: "軟体動物", zh: "软体动物", ru: "моллюски" },
};

export const TAG_NAMES: Record<TagCode, Names> = {
  pork: { it: "maiale", en: "pork", de: "Schweinefleisch", fr: "porc", es: "cerdo", ja: "豚肉", zh: "猪肉", ru: "свинина" },
  beef: { it: "manzo", en: "beef", de: "Rindfleisch", fr: "bœuf", es: "carne de vacuno", ja: "牛肉", zh: "牛肉", ru: "говядина" },
  veal: { it: "vitello", en: "veal", de: "Kalbfleisch", fr: "veau", es: "ternera", ja: "仔牛肉", zh: "小牛肉", ru: "телятина" },
  lamb: { it: "agnello", en: "lamb", de: "Lammfleisch", fr: "agneau", es: "cordero", ja: "子羊肉", zh: "羔羊肉", ru: "ягнятина" },
  poultry: { it: "pollame", en: "poultry", de: "Geflügel", fr: "volaille", es: "aves", ja: "家禽肉", zh: "禽肉", ru: "птица" },
  meat: { it: "carne", en: "meat", de: "Fleisch", fr: "viande", es: "carne", ja: "肉", zh: "肉类", ru: "мясо" },
  fish_seafood: { it: "pesce e frutti di mare", en: "fish and seafood", de: "Fisch und Meeresfrüchte", fr: "poisson et fruits de mer", es: "pescado y marisco", ja: "魚介類", zh: "鱼类和海鲜", ru: "рыба и морепродукты" },
  alcohol: { it: "alcol", en: "alcohol", de: "Alkohol", fr: "alcool", es: "alcohol", ja: "アルコール", zh: "酒精", ru: "алкоголь" },
};

export const DIET_NAMES: Record<DietCode, Names> = {
  vegetarian: { it: "vegetariano", en: "vegetarian", de: "vegetarisch", fr: "végétarien", es: "vegetariano", ja: "ベジタリアン", zh: "素食", ru: "вегетарианец" },
  vegan: { it: "vegano", en: "vegan", de: "vegan", fr: "végan", es: "vegano", ja: "ヴィーガン", zh: "纯素", ru: "веган" },
  no_pork: { it: "senza maiale", en: "no pork", de: "kein Schweinefleisch", fr: "sans porc", es: "sin cerdo", ja: "豚肉なし", zh: "不含猪肉", ru: "без свинины" },
  no_beef: { it: "senza manzo", en: "no beef", de: "kein Rindfleisch", fr: "sans bœuf", es: "sin vacuno", ja: "牛肉なし", zh: "不含牛肉", ru: "без говядины" },
  no_alcohol: { it: "senza alcol", en: "no alcohol", de: "kein Alkohol", fr: "sans alcool", es: "sin alcohol", ja: "アルコールなし", zh: "不含酒精", ru: "без алкоголя" },
};

export function isAllergenCode(code: string): code is AllergenCode {
  return (ALLERGEN_CODES as readonly string[]).includes(code);
}
