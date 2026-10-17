import { readJSON, writeJSON } from "@/lib/channel";
import { LANGS, type Lang } from "@/lib/i18n";
import { DinerProfileSchema, type DinerProfile } from "@/lib/schema";

// Browser-only: the diner profile lives in localStorage and is mirrored in the
// URL, so a link like /m/demo-trattoria?lang=ja&aud=first_timer&allergens=fish
// opens the menu ready for that diner.

const PROFILE_KEY = "menubridge:profile";

function list(params: URLSearchParams, name: string): string[] {
  return (params.get(name) ?? "").split(",").filter(Boolean);
}

export function profileFromParams(params: URLSearchParams): DinerProfile | null {
  if (!params.get("lang") || !params.get("aud")) return null;
  const parsed = DinerProfileSchema.safeParse({
    lang: params.get("lang"),
    audience: params.get("aud"),
    allergens: list(params, "allergens"),
    diets: list(params, "diets"),
    excludedIngredientIds: list(params, "exclude"),
  });
  return parsed.success ? parsed.data : null;
}

export function profileToParams(profile: DinerProfile, base: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  params.set("lang", profile.lang);
  params.set("aud", profile.audience);
  const lists: [string, string[]][] = [
    ["allergens", profile.allergens],
    ["diets", profile.diets],
    ["exclude", profile.excludedIngredientIds],
  ];
  for (const [name, values] of lists) {
    if (values.length > 0) params.set(name, values.join(","));
    else params.delete(name);
  }
  return params;
}

export function loadStoredProfile(): DinerProfile | null {
  const parsed = DinerProfileSchema.safeParse(readJSON<unknown>(PROFILE_KEY, null));
  return parsed.success ? parsed.data : null;
}

export function saveProfile(profile: DinerProfile) {
  writeJSON(PROFILE_KEY, profile);
  const params = profileToParams(profile, new URLSearchParams(window.location.search));
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

export function browserLang(): Lang {
  const code = (navigator.language || "en").slice(0, 2).toLowerCase();
  return (LANGS as readonly string[]).includes(code) ? (code as Lang) : "en";
}
