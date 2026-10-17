// Facts shown on the landing and About pages. Update PILOT after the trattoria visit.

export const REPO_URL = "https://github.com/feedddosever/amdgimmemyaccess";

// Starting guess for the restaurant's subscription, to be tested with the pilot.
export const PRICE_PER_MONTH_EUR = 29;

export const PILOT: { status: "seeking" | "agreed"; restaurant?: string; quote?: string } = {
  status: "seeking",
};

export const DEMO_LINKS = {
  japaneseTourist: "/m/demo-trattoria?lang=ja&aud=first_timer&table=7",
  fishAllergy: "/m/demo-trattoria?lang=en&aud=dietary&allergens=fish&table=4",
};

// The four diners of the /demo screen and the video, with the order each one types.
// scripts/warm-cache.ts saves the model's answers for exactly these, so the demo
// still works with the GPU switched off.
export const DEMO_PRESETS: {
  label: string;
  profile: { lang: "ja" | "de" | "en" | "it"; audience: "first_timer" | "family" | "dietary" | "foodie"; allergens: "fish"[]; diets: "no_pork"[] };
  order: string;
}[] = [
  {
    label: "Japanese first-timer",
    profile: { lang: "ja", audience: "first_timer", allergens: [], diets: [] },
    order: "ローマらしい料理をお願いします。でも豚肉は抜きで。6歳の子どもにはシンプルなものを。",
  },
  {
    label: "German family with a child",
    profile: { lang: "de", audience: "family", allergens: [], diets: [] },
    order: "Für mich die Saltimbocca und für mein Kind (5 Jahre) etwas Einfaches, bitte.",
  },
  {
    label: "English diner: fish allergy, no pork",
    profile: { lang: "en", audience: "dietary", allergens: ["fish"], diets: ["no_pork"] },
    order: "Something typically Roman to start, then a pasta and a dessert, please.",
  },
  {
    label: "Italian food lover",
    profile: { lang: "it", audience: "foodie", allergens: [], diets: [] },
    order: "Vorrei la coda alla vaccinara e poi un tiramisù.",
  },
];

export function presetParams(preset: (typeof DEMO_PRESETS)[number]): string {
  const params = new URLSearchParams({ lang: preset.profile.lang, aud: preset.profile.audience });
  if (preset.profile.allergens.length) params.set("allergens", preset.profile.allergens.join(","));
  if (preset.profile.diets.length) params.set("diets", preset.profile.diets.join(","));
  return params.toString();
}
