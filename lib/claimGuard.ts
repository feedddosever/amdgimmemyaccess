// Rejects AI text that makes a safety or diet claim. Only lib/gate.ts may say
// what a diner can eat; a description that says "gluten-free" or "safe for"
// could contradict it. Every language's list is checked against every text,
// because a reply can mix languages.
const CLAIM_PHRASES = [
  // en
  "gluten-free", "gluten free", "allergen-free", "allergen free", "dairy-free", "dairy free",
  "lactose-free", "lactose free", "nut-free", "nut free", "egg-free", "free from", "free of",
  "safe for", "suitable for", "no allergens", "plant-based", "vegan", "vegetarian", "coeliac", "celiac",
  // it
  "senza glutine", "senza lattosio", "senza allergeni", "privo di", "priva di", "adatto a",
  "adatta a", "sicuro per", "sicura per", "vegano", "vegana", "vegetariano", "vegetariana", "celiac",
  // de
  "glutenfrei", "laktosefrei", "allergenfrei", "ohne gluten", "frei von", "geeignet für",
  "sicher für", "vegetarisch",
  // fr
  "sans gluten", "sans lactose", "sans allergène", "adapté aux", "convient aux", "sans danger",
  "sûr pour", "végan", "végétalien", "végétarien", "cœliaque",
  // es
  "sin gluten", "sin lactosa", "sin alérgenos", "libre de", "apto para", "seguro para",
  "vegetariano", "celíac",
  // ja
  "グルテンフリー", "グルテン不使用", "アレルゲンフリー", "アレルギー対応", "乳製品不使用",
  "卵不使用", "不使用", "安心", "安全", "ヴィーガン", "ビーガン", "ベジタリアン", "菜食",
  // zh
  "无麸质", "不含麸质", "无过敏原", "不含过敏原", "无乳糖", "不含", "适合过敏", "纯素", "素食", "安全",
  // ru
  "без глютена", "безглютенов", "без лактозы", "без аллергенов", "безопасн", "подходит для",
  "не содержит", "веган", "вегетариан",
];

export function findClaim(...texts: string[]): string | null {
  const haystack = texts.join(" \n ").toLowerCase().normalize("NFC");
  return CLAIM_PHRASES.find((phrase) => haystack.includes(phrase)) ?? null;
}
