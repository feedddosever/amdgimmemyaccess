import type { AllergenCode, DietCode, TagCode } from "@/lib/allergens";
import { type Lang, childAge, fillTemplate, ingredientName, mentionsChild } from "@/lib/i18n";
import { type DraftIngredient, type MenuDraft, slugify, uniqueId } from "@/lib/menuDraft";
import type { Category, DinerProfile, Dish, Menu } from "@/lib/schema";
import type { OrderOutput, PersonalizeOutput } from "@/lib/tasks";

// Canned model answers for MOCK_LLM=1. Like the real prompts, they describe
// dishes but never make allergen, diet or safety claims, and they never apply
// the gate: lib/gate.ts does that after the "model" answers.

type DishText = { name: string; explanation: string };

// Hand-written for the demo menu in the four demo-preset languages.
const DEMO_TEXT: Record<string, Partial<Record<Lang, DishText>>> = {
  suppli: {
    en: { name: "Supplì (fried rice croquette)", explanation: "A Roman street-food classic: a crisp fried rice ball in tomato and beef sauce with a stretchy mozzarella heart." },
    ja: { name: "スップリ（ローマ風ライスコロッケ）", explanation: "トマトと牛ひき肉のソースで煮たお米で、とろけるモッツァレラを包んで揚げた、ローマの定番ストリートフードです。" },
    it: { name: "Supplì", explanation: "Il classico dello street food romano: riso al sugo con un cuore di mozzarella filante, fritto e croccante." },
    de: { name: "Supplì (frittierte Reiskrokette)", explanation: "Ein römischer Streetfood-Klassiker: knusprig frittierte Reiskugel in Tomaten-Rindfleisch-Sauce mit schmelzendem Mozzarella-Kern." },
  },
  carciofi_alla_giudia: {
    en: { name: "Jewish-style artichoke", explanation: "A whole Roman artichoke fried until its leaves open like a crisp golden flower, a recipe from Rome's Jewish Ghetto." },
    ja: { name: "カルチョーフィ・アッラ・ジュディア（ユダヤ風揚げアーティチョーク）", explanation: "ローマ産アーティチョークを丸ごと揚げて花のようにパリッと開かせた、ローマのユダヤ人地区に伝わる料理です。" },
    it: { name: "Carciofi alla giudia", explanation: "Carciofo romanesco fritto intero che si apre come un fiore dorato: un piatto simbolo del Ghetto ebraico." },
    de: { name: "Artischocke nach jüdischer Art", explanation: "Eine ganze römische Artischocke, so frittiert, dass sich die Blätter wie eine knusprige goldene Blüte öffnen – ein Rezept aus dem jüdischen Ghetto Roms." },
  },
  puntarelle: {
    en: { name: "Puntarelle salad", explanation: "Crunchy shoots of Roman chicory, thinly sliced and dressed with a punchy anchovy, garlic and vinegar sauce." },
    ja: { name: "プンタレッレのサラダ", explanation: "シャキシャキしたローマのチコリの新芽を細く切り、アンチョビとにんにく、酢のソースで和えた冬の味覚です。" },
    it: { name: "Puntarelle alla romana", explanation: "Germogli di cicoria croccanti con una salsa decisa di alici, aglio e aceto: il sapore dell'inverno romano." },
    de: { name: "Puntarelle-Salat", explanation: "Knackige Sprossen der römischen Zichorie, fein geschnitten und mit einer kräftigen Sauce aus Sardellen, Knoblauch und Essig angemacht." },
  },
  carbonara: {
    en: { name: "Spaghetti carbonara", explanation: "Rome's most famous pasta: spaghetti tossed with crisp cured pork cheek, egg yolk, pecorino and black pepper." },
    ja: { name: "スパゲッティ・アッラ・カルボナーラ", explanation: "カリカリのグアンチャーレ（豚ほほ肉の塩漬け）、卵黄、ペコリーノ、黒こしょうで仕上げる、ローマを代表するパスタです。" },
    it: { name: "Spaghetti alla carbonara", explanation: "La regina dei primi romani: guanciale croccante, tuorlo, pecorino e pepe nero." },
    de: { name: "Spaghetti Carbonara", explanation: "Roms berühmteste Pasta: Spaghetti mit knusprigem Guanciale (gepökelte Schweinebacke), Eigelb, Pecorino und schwarzem Pfeffer." },
  },
  cacio_e_pepe: {
    en: { name: "Tonnarelli cacio e pepe", explanation: "Thick square-cut pasta tossed with pecorino romano and freshly ground black pepper into a creamy sauce." },
    ja: { name: "トンナレッリ・カチョ・エ・ペペ", explanation: "太めのパスタをペコリーノ・ロマーノと挽きたての黒こしょうで、なめらかなソースに仕上げたシンプルな一皿です。" },
    it: { name: "Tonnarelli cacio e pepe", explanation: "Pecorino romano e pepe nero macinato al momento, mantecati fino a diventare una crema avvolgente." },
    de: { name: "Tonnarelli Cacio e Pepe", explanation: "Dicke Nudeln, mit Pecorino Romano und frisch gemahlenem schwarzem Pfeffer zu einer cremigen Sauce geschwenkt." },
  },
  amatriciana: {
    en: { name: "Rigatoni all'amatriciana", explanation: "Tube pasta in a tomato sauce with cured pork cheek and pecorino, named after the mountain town of Amatrice." },
    ja: { name: "リガトーニ・アッラマトリチャーナ", explanation: "トマトソースにグアンチャーレとペコリーノを合わせた、山あいの町アマトリーチェに由来するパスタです。" },
    it: { name: "Rigatoni all'amatriciana", explanation: "Sugo di pomodoro, guanciale e pecorino: la ricetta nata ad Amatrice e adottata da Roma." },
    de: { name: "Rigatoni all'Amatriciana", explanation: "Röhrennudeln in Tomatensauce mit Guanciale und Pecorino, benannt nach dem Bergstädtchen Amatrice." },
  },
  gricia: {
    en: { name: "Pasta alla gricia", explanation: "The ancestor of carbonara and amatriciana: rigatoni with crisp cured pork cheek, pecorino and black pepper." },
    ja: { name: "パスタ・アッラ・グリーチャ", explanation: "カルボナーラとアマトリチャーナの原型といわれる、グアンチャーレとペコリーノ、黒こしょうのパスタです。" },
    it: { name: "Pasta alla gricia", explanation: "L'antenata di carbonara e amatriciana: guanciale croccante, pecorino e pepe nero." },
    de: { name: "Pasta alla Gricia", explanation: "Die Urform von Carbonara und Amatriciana: Rigatoni mit knusprigem Guanciale, Pecorino und schwarzem Pfeffer." },
  },
  saltimbocca: {
    en: { name: "Saltimbocca alla romana", explanation: "Thin veal escalopes topped with prosciutto and sage, cooked in butter and white wine – the name means 'jumps in the mouth'." },
    ja: { name: "サルティンボッカ・アッラ・ロマーナ", explanation: "薄切りの仔牛肉に生ハムとセージをのせ、バターと白ワインで焼き上げた料理で、名前は「口に飛び込む」という意味です。" },
    it: { name: "Saltimbocca alla romana", explanation: "Fettine di vitello con prosciutto e salvia sfumate al vino bianco, così buone che saltano in bocca." },
    de: { name: "Saltimbocca alla Romana", explanation: "Dünne Kalbsschnitzel mit Prosciutto und Salbei, in Butter und Weißwein gebraten – der Name bedeutet „springt in den Mund“." },
  },
  coda_alla_vaccinara: {
    en: { name: "Roman oxtail stew", explanation: "Oxtail slow-braised for hours with tomato, celery and red wine, a dish born in Rome's old slaughterhouse district." },
    ja: { name: "コーダ・アッラ・ヴァッチナーラ（牛テールの煮込み）", explanation: "牛テールをトマト、セロリ、赤ワインで何時間も煮込んだ、ローマの旧屠畜場地区で生まれた料理です。" },
    it: { name: "Coda alla vaccinara", explanation: "Coda di bue stufata per ore con pomodoro, sedano e vino rosso: la cucina del quinto quarto di Testaccio." },
    de: { name: "Römischer Ochsenschwanz-Eintopf", explanation: "Ochsenschwanz, stundenlang mit Tomaten, Sellerie und Rotwein geschmort – ein Gericht aus Roms altem Schlachthofviertel." },
  },
  abbacchio_scottadito: {
    en: { name: "Grilled lamb chops", explanation: "Young lamb chops grilled with rosemary and eaten by hand while still hot – 'scottadito' means 'burnt fingers'." },
    ja: { name: "アバッキオ・ア・スコッタディート（仔羊のグリル）", explanation: "ローズマリーで香りづけした仔羊のチョップを焼いて熱々を手で食べる料理で、名前は「指をやけどする」という意味です。" },
    it: { name: "Abbacchio a scottadito", explanation: "Costolette di agnello alla griglia da mangiare con le mani, così calde da scottare le dita." },
    de: { name: "Gegrillte Lammkoteletts", explanation: "Koteletts vom jungen Lamm mit Rosmarin, heiß mit den Händen gegessen – „scottadito“ heißt „verbrannte Finger“." },
  },
  piatto_del_giorno: {
    en: { name: "Dish of the day", explanation: "Today's dish depends on the market; ask the staff what the kitchen is cooking." },
    ja: { name: "本日のおすすめ", explanation: "市場の仕入れで内容が変わる本日の一皿です。内容はスタッフにお尋ねください。" },
    it: { name: "Piatto del giorno", explanation: "Cambia ogni giorno secondo il mercato: chiedete al personale cosa propone la cucina." },
    de: { name: "Tagesgericht", explanation: "Wechselt täglich je nach Marktangebot; fragen Sie das Personal, was die Küche heute kocht." },
  },
  cicoria_ripassata: {
    en: { name: "Sautéed chicory", explanation: "Chicory boiled, then pan-fried with garlic, olive oil and a little chilli – Rome's favourite side dish." },
    ja: { name: "チコリア・リパッサータ（チコリのソテー）", explanation: "ゆでたチコリをにんにく、オリーブオイル、唐辛子でさっと炒めた、ローマで定番の付け合わせです。" },
    it: { name: "Cicoria ripassata", explanation: "Cicoria lessata e ripassata in padella con aglio, olio e peperoncino: il contorno romano per eccellenza." },
    de: { name: "Gebratene Zichorie", explanation: "Gekochte Zichorie, in der Pfanne mit Knoblauch, Olivenöl und etwas Chili geschwenkt – Roms liebste Beilage." },
  },
  tiramisu: {
    en: { name: "Tiramisù", explanation: "Coffee-soaked ladyfingers layered with mascarpone cream and dusted with cocoa; the name means 'pick me up'." },
    ja: { name: "ティラミス", explanation: "コーヒーを染み込ませたサヴォイアルディにマスカルポーネのクリームを重ね、ココアをふったデザートで、名前は「元気づけて」という意味です。" },
    it: { name: "Tiramisù", explanation: "Savoiardi inzuppati nel caffè, crema al mascarpone e una spolverata di cacao amaro." },
    de: { name: "Tiramisù", explanation: "In Kaffee getränkte Löffelbiskuits mit Mascarpone-Creme und Kakao – der Name bedeutet „zieh mich hoch“." },
  },
};

// Any other menu or language: a plain description built from the ingredient sheet.
const FALLBACK_TEMPLATE: Record<Lang, string> = {
  it: "{name}, preparato con {ingredients}.",
  en: "{name}, prepared with {ingredients}.",
  de: "{name}, zubereitet mit {ingredients}.",
  fr: "{name}, préparé avec {ingredients}.",
  es: "{name}, preparado con {ingredients}.",
  ja: "{ingredients}を使った「{name}」です。",
  zh: "「{name}」，主要食材：{ingredients}。",
  ru: "{name}: приготовлено из следующих продуктов — {ingredients}.",
};

const KIDS_LINE: Record<Lang, string> = {
  it: "Di solito piace ai bambini.",
  en: "Children usually like it.",
  de: "Kinder mögen es meistens.",
  fr: "Les enfants l'apprécient généralement.",
  es: "Suele gustar a los niños.",
  ja: "お子さまにも人気です。",
  zh: "孩子们通常很喜欢。",
  ru: "Обычно нравится детям.",
};

function dishText(dish: Dish, menu: Menu, lang: Lang): DishText {
  const canned = menu.restaurant.id === "demo-trattoria" ? DEMO_TEXT[dish.id]?.[lang] : undefined;
  if (canned) return canned;
  const separator = lang === "ja" || lang === "zh" ? "、" : ", ";
  const ingredients = dish.ingredientIds
    .map((id) => menu.ingredients.find((ingredient) => ingredient.id === id))
    .filter((ingredient) => ingredient !== undefined)
    .map((ingredient) => ingredientName(ingredient, lang))
    .join(separator);
  return {
    name: dish.nameIt,
    explanation: ingredients ? fillTemplate(FALLBACK_TEMPLATE[lang], { name: dish.nameIt, ingredients }) : `${dish.nameIt}.`,
  };
}

export function mockPersonalize(menu: Menu, dishes: Dish[], profile: Pick<DinerProfile, "lang" | "audience">): PersonalizeOutput {
  return {
    dishes: dishes.map((dish) => {
      const text = dishText(dish, menu, profile.lang);
      const explanation =
        profile.audience === "family" && dish.kidFriendly ? `${text.explanation} ${KIDS_LINE[profile.lang]}` : text.explanation;
      return { dishId: dish.id, localizedName: text.name, explanation };
    }),
  };
}

// Keyword cues for the order mock, across the 8 UI languages. Lowercase. Any
// mention of pork counts as "no pork": in an order it is almost always an exclusion.
const ROMAN = ["roman", "rome", "romano", "romana", "römisch", "romain", "ローマ", "罗马", "римск"];
const ALLERGY = ["allerg", "アレルギー", "过敏", "аллерг", "celiac", "celiach", "zöliak", "cœliaque", "celíac"];
const DIET_CUES: Record<DietCode, string[]> = {
  no_pork: ["pork", "maiale", "schwein", "porc", "cerdo", "豚", "猪肉", "свинин"],
  no_beef: ["no beef", "senza manzo", "kein rind", "sans bœuf", "sin vacuno", "牛肉なし", "牛肉は", "不吃牛肉", "без говядины"],
  no_alcohol: ["no alcohol", "senza alcol", "kein alkohol", "sans alcool", "sin alcohol", "アルコールなし", "不含酒精", "без алкоголя"],
  vegetarian: ["vegetari", "végétarien", "ベジタリアン", "素食", "вегетариан"],
  vegan: ["vegan", "végan", "ヴィーガン", "纯素", "веган"],
};
const ALLERGEN_CUES: Partial<Record<AllergenCode, string[]>> = {
  fish: ["fish", "pesce", "fisch", "poisson", "pescado", "魚", "鱼", "рыб"],
  nuts: ["tree nut", "walnut", "hazelnut", "almond", "noci", "nocciol", "mandorl", "walnuss", "haselnuss", "mandel", "noix", "nueces", "ナッツ", "坚果", "орех"],
  peanuts: ["peanut", "arachid", "erdnuss", "cacahuete", "ピーナッツ", "落花生", "花生", "арахис"],
  gluten: ["gluten", "glutine", "グルテン", "麸质", "глютен", "celiac", "celiach", "zöliak", "cœliaque", "celíac"],
  milk: ["lactose", "lattosio", "laktose", "dairy", "乳製品", "乳糖", "牛奶", "молок", "лактоз"],
  eggs: ["egg", "uova", "uovo", "eier", "œuf", "huevo", "卵", "鸡蛋", "яйц"],
  crustaceans: ["shellfish", "shrimp", "crostacei", "krebstier", "crustacé", "marisco", "甲殻類", "えび", "虾", "ракообраз"],
};
const DISH_ALIASES: Record<string, string[]> = {
  suppli: ["suppli", "supplì", "スップリ", "ライスコロッケ"],
  carciofi_alla_giudia: ["carciof", "artichoke", "artischocke", "artichaut", "alcachofa", "アーティチョーク", "カルチョーフィ", "洋蓟", "артишок"],
  puntarelle: ["puntarelle", "プンタレッレ"],
  carbonara: ["carbonara", "カルボナーラ", "卡邦尼", "карбонар"],
  cacio_e_pepe: ["cacio e pepe", "cacio", "カチョ", "カッチョ"],
  amatriciana: ["amatrician", "アマトリチャーナ"],
  gricia: ["gricia", "グリーチャ"],
  saltimbocca: ["saltimbocca", "サルティンボッカ"],
  coda_alla_vaccinara: ["vaccinara", "oxtail", "ochsenschwanz", "テール", "牛尾", "бычий хвост"],
  abbacchio_scottadito: ["abbacchio", "scottadito", "lamb", "lamm", "agneau", "cordero", "仔羊", "ラム", "羊", "ягн", "баранин"],
  cicoria_ripassata: ["cicoria", "chicory", "チコリ"],
  tiramisu: ["tiramis", "ティラミス", "提拉米苏", "тирамису"],
  piatto_del_giorno: ["piatto del giorno", "dish of the day", "tagesgericht", "plat du jour", "plato del día", "本日のおすすめ", "今日のおすすめ"],
};
const CHILD_LABEL: Record<Lang, string> = {
  it: "bambino",
  en: "child",
  de: "Kind",
  fr: "enfant",
  es: "niño",
  ja: "子ども",
  zh: "孩子",
  ru: "ребёнок",
};
const CLARIFY: Record<Lang, string> = {
  it: "Quali piatti desideri? Puoi nominarli o descrivere cosa ti va di mangiare.",
  en: "Which dishes would you like? You can name them or describe what you feel like eating.",
  de: "Welche Gerichte möchten Sie? Nennen Sie sie oder beschreiben Sie, worauf Sie Lust haben.",
  fr: "Quels plats souhaitez-vous ? Nommez-les ou décrivez ce dont vous avez envie.",
  es: "¿Qué platos te apetecen? Puedes nombrarlos o describir lo que te gustaría comer.",
  ja: "どの料理になさいますか？料理名か、召し上がりたいものを教えてください。",
  zh: "您想点哪些菜？可以说出菜名，或描述您想吃的东西。",
  ru: "Какие блюда вы хотите? Назовите их или опишите, что вам хотелось бы съесть.",
};

function mentions(text: string, cues: string[]): boolean {
  return cues.some((cue) => text.includes(cue));
}

export function mockOrder(menu: Menu, profile: Pick<DinerProfile, "lang">, text: string): OrderOutput {
  const lower = text.toLowerCase().normalize("NFC");
  const items: OrderOutput["items"] = [];
  const add = (dishId: string, item: Partial<OrderOutput["items"][number]> = {}) => {
    if (menu.dishes.some((dish) => dish.id === dishId) && !items.some((existing) => existing.dishId === dishId)) {
      items.push({ dishId, qty: 1, ...item });
    }
  };

  for (const [dishId, aliases] of Object.entries(DISH_ALIASES)) {
    for (const alias of aliases) {
      const index = lower.indexOf(alias);
      if (index === -1) continue;
      // "2 carbonara", "2x carbonara" or "カルボナーラを2つ" / "carbonara x2".
      const before = lower.slice(Math.max(0, index - 4), index).match(/(\d{1,2})\s*x?\s*$/)?.[1];
      const after = lower.slice(index + alias.length, index + alias.length + 6).match(/^\s*(?:を|x|×)?\s*(\d{1,2})/)?.[1];
      const qty = Number(before ?? after ?? 1);
      add(dishId, { qty: Math.min(Math.max(qty, 1), 10) });
      break;
    }
  }

  // "Something typically Roman" maps to the first primo; the gate decides if it stays.
  if (items.length === 0 && mentions(lower, ROMAN)) {
    const primo = menu.dishes.find((dish) => dish.category === "primi" && dish.ownerApproved);
    if (primo) add(primo.id);
  }

  if (mentionsChild(lower)) {
    const age = childAge(lower);
    const forWhom = age ? `${CHILD_LABEL[profile.lang]} (${age})` : CHILD_LABEL[profile.lang];
    const kidsDish = menu.dishes.find(
      (dish) => dish.kidFriendly && dish.category === "primi" && !items.some((item) => item.dishId === dish.id),
    );
    if (kidsDish) add(kidsDish.id, { forWhom });
  }

  const diets = (Object.keys(DIET_CUES) as DietCode[]).filter((diet) => mentions(lower, DIET_CUES[diet]));
  const allergens = mentions(lower, ALLERGY)
    ? (Object.keys(ALLERGEN_CUES) as AllergenCode[]).filter((code) => mentions(lower, ALLERGEN_CUES[code] ?? []))
    : [];

  const understood = items.length > 0;
  return {
    items,
    extractedConstraints: { allergens, diets, excludedIngredientIds: [] },
    unmatchedRequests: understood ? [] : [text.slice(0, 200)],
    ...(understood ? {} : { clarifyingQuestion: CLARIFY[profile.lang] }),
  };
}

// Menu import: reads lines like "Carbonara (guanciale, uovo, pecorino) 13" under
// section headers, and suggests allergens from Italian ingredient names. The real
// model does this better; either way the owner confirms every dish.
const SECTION_CUES: Record<Category, string[]> = {
  antipasti: ["antipast"],
  primi: ["primi", "primo"],
  secondi: ["secondi", "secondo", "pizz"],
  contorni: ["contorn"],
  dolci: ["dolci", "dessert"],
};
const INGREDIENT_FACTS: { cues: string[]; allergens?: AllergenCode[]; tags?: TagCode[] }[] = [
  { cues: ["farina", "pane", "pasta", "spaghetti", "fettuccine", "rigatoni", "tonnarelli", "penne", "bucatini", "gnocchi", "pangrattato", "biscott", "grano", "orzo"], allergens: ["gluten"] },
  { cues: ["uovo", "uova", "tuorl", "maionese"], allergens: ["eggs"] },
  { cues: ["savoiardi"], allergens: ["gluten", "eggs"] },
  { cues: ["latte", "burro", "panna", "mozzarella", "pecorino", "parmigiano", "ricotta", "mascarpone", "formaggi", "burrata", "provola", "scamorza", "gorgonzola", "besciamella"], allergens: ["milk"] },
  { cues: ["alici", "acciugh", "tonno", "baccal", "pesce", "salmone", "merluzzo", "orata", "spigola", "branzino", "sardin"], allergens: ["fish"], tags: ["fish_seafood"] },
  { cues: ["gamber", "scampi", "aragost", "astice", "granchi"], allergens: ["crustaceans"], tags: ["fish_seafood"] },
  { cues: ["vongol", "cozz", "calamar", "polp", "seppi", "totan", "ostric"], allergens: ["molluscs"], tags: ["fish_seafood"] },
  { cues: ["sedano"], allergens: ["celery"] },
  { cues: ["vino", "marsala"], allergens: ["sulphites"], tags: ["alcohol"] },
  { cues: ["aceto"], allergens: ["sulphites"] },
  { cues: ["noci", "nocciol", "pistacch", "mandorl", "anacard"], allergens: ["nuts"] },
  { cues: ["arachid"], allergens: ["peanuts"] },
  { cues: ["sesamo"], allergens: ["sesame"] },
  { cues: ["senape"], allergens: ["mustard"] },
  { cues: ["soia"], allergens: ["soy"] },
  { cues: ["lupin"], allergens: ["lupin"] },
  { cues: ["guanciale", "pancetta", "prosciutto", "salsicc", "maiale", "lardo", "porchetta", "mortadella", "salame", "speck", "gelatina"], tags: ["pork", "meat"] },
  { cues: ["manzo", "bue", "bovin", "bresaola"], tags: ["beef", "meat"] },
  { cues: ["vitello"], tags: ["veal", "meat"] },
  { cues: ["agnello", "abbacchio"], tags: ["lamb", "meat"] },
  { cues: ["pollo", "tacchino", "anatra", "faraona"], tags: ["poultry", "meat"] },
];
const PRICE = /(?:€\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?\s*$/i;

function suggestFacts(name: string): Pick<DraftIngredient, "allergens" | "tags"> {
  const lower = name.toLowerCase();
  const allergens = new Set<AllergenCode>();
  const tags = new Set<TagCode>();
  for (const fact of INGREDIENT_FACTS) {
    if (!fact.cues.some((cue) => lower.includes(cue))) continue;
    fact.allergens?.forEach((code) => allergens.add(code));
    fact.tags?.forEach((tag) => tags.add(tag));
  }
  return { allergens: [...allergens], tags: [...tags] };
}

export function mockMenuDraft(text: string): MenuDraft {
  let category: Category = "secondi";
  const ingredients = new Map<string, DraftIngredient>();
  const dishes: MenuDraft["dishes"] = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const price = line.match(PRICE);
    if (!price && !line.includes("(")) {
      const header = line.toLowerCase();
      const section = (Object.keys(SECTION_CUES) as Category[]).find((key) => SECTION_CUES[key].some((cue) => header.startsWith(cue)));
      if (section) category = section;
      continue;
    }
    const body = (price ? line.slice(0, price.index) : line).trim().replace(/[\s.:–—-]+$/, "");
    const parts = body.match(/^([^(:–—]+?)\s*(?:\((.*)\)|[:–—]\s*(.*))?$/);
    const name = (parts?.[1] ?? body).trim();
    if (!name) continue;
    const listed = (parts?.[2] ?? parts?.[3] ?? "")
      .split(/,|\se\s|\scon\s/)
      .map((item) => item.trim())
      .filter(Boolean);
    const ingredientIds = listed.map((item) => {
      const id = slugify(item) || uniqueId(item, ingredients.keys());
      if (!ingredients.has(id)) ingredients.set(id, { id, it: item, en: item, ...suggestFacts(item) });
      return id;
    });
    dishes.push({
      id: uniqueId(name, dishes.map((dish) => dish.id)),
      category,
      nameIt: name,
      descriptionIt: listed.length ? `${name} con ${listed.join(", ")}.` : `${name}.`,
      priceEur: price ? Number(price[1].replace(",", ".")) || null : null,
      ingredientIds: [...new Set(ingredientIds)],
    });
  }
  return { ingredients: [...ingredients.values()], dishes };
}
