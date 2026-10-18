"use client";

import Link from "next/link";
import { useState } from "react";
import { flushSync } from "react-dom";
import { ALLERGEN_NAMES } from "@/lib/allergens";
import { LANGS, LOCALES, t, type Lang } from "@/lib/i18n";
import { clearMeals, loadMeals, type Meal } from "@/lib/meals";
import { browserLang, loadStoredProfile } from "@/lib/profile";
import { kitchenForWhom } from "@/lib/ticket";

function initialLang(): Lang {
  const param = new URLSearchParams(window.location.search).get("lang");
  if (param && (LANGS as readonly string[]).includes(param)) return param as Lang;
  return loadStoredProfile()?.lang ?? browserLang();
}

function MealCard({ meal, lang, italian }: { meal: Meal; lang: Lang; italian: boolean }) {
  const when = new Date(meal.createdAt).toLocaleString(LOCALES[lang], { dateStyle: "medium", timeStyle: "short" });
  return (
    <article className="flex break-inside-avoid flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line print:rounded-none print:p-0 print:shadow-none print:ring-0">
      <h2 className="font-semibold">
        {when} · {meal.restaurantName} · {t(lang, "table", { table: meal.table })}
      </h2>
      {meal.dishes.map((dish, index) => (
        <section key={index} className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="font-semibold">
            {dish.qty}× {dish.nameIt}
            {dish.forWhom ? <span className="font-normal text-muted"> ({italian ? kitchenForWhom(dish.forWhom) : dish.forWhom})</span> : null}
          </h3>
          <p className="text-sm">
            <span className="font-medium">{t(lang, "mealsIngredients")}:</span>{" "}
            {dish.ingredients.map((ingredient) => (italian ? ingredient.it : ingredient.local)).join(lang === "ja" || lang === "zh" ? "、" : ", ")}
          </p>
          {!dish.ownerApproved ? (
            <p className="rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">{t(lang, "mealsUnverified")}</p>
          ) : dish.allergens.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t(lang, "mealsAllergens")}:</p>
              <ul className="flex flex-wrap gap-2">
                {dish.allergens.map((code) => (
                  <li key={code} className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900 ring-1 ring-amber-200">
                    {ALLERGEN_NAMES[code][lang]}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">{t(lang, "mealsNoAllergens")}</p>
          )}
        </section>
      ))}
    </article>
  );
}

// What the printer or "Save as PDF" gets: the record in the diner's language, then in
// Italian on a new page for a doctor in Italy. Nothing here comes from the model.
function PrintRecord({ meals, lang, printedAt }: { meals: Meal[]; lang: Lang; printedAt: string }) {
  const versions: Lang[] = lang === "it" ? ["it"] : [lang, "it"];
  return (
    <div className="hidden flex-col gap-10 text-black print:flex">
      {versions.map((version, index) => (
        <section key={version} lang={version} className={`flex flex-col gap-4 ${index > 0 ? "break-before-page" : ""}`}>
          <h2 className="text-2xl font-bold">{t(version, "mealsPrintTitle")}</h2>
          <p className="text-sm">
            MenuBridge · {t(version, "mealsPrintedOn", { date: new Date(printedAt).toLocaleString(LOCALES[version], { dateStyle: "long", timeStyle: "short" }) })}
          </p>
          <p className="text-sm">{t(version, "mealsIntro")}</p>
          {meals.map((meal) => (
            <MealCard key={meal.mealId} meal={meal} lang={version} italian={version === "it"} />
          ))}
          <p className="border-t border-black/30 pt-3 text-sm">{t(version, "mealsNotMedical")}</p>
        </section>
      ))}
    </div>
  );
}

export default function MealsApp({ restaurantId }: { restaurantId: string }) {
  const [lang] = useState(initialLang);
  const [meals, setMeals] = useState<Meal[]>(loadMeals);
  const [italian, setItalian] = useState(false);
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());
  // "Show in Italian for a doctor" switches the page, labels and ingredient names included.
  const shown: Lang = italian ? "it" : lang;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col print:min-h-0 print:max-w-none" lang={shown}>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur print:hidden">
        <h1 className="text-lg font-semibold leading-tight">{t(shown, "mealsTitle")}</h1>
        <Link
          href={`/m/${restaurantId}?lang=${lang}`}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 font-semibold text-white"
        >
          {t(lang, "backToMenu")}
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-4 py-5 print:hidden">
        <p>{t(shown, "mealsIntro")}</p>
        <p className="font-semibold">{t(shown, "mealsDoctor")}</p>
        {lang !== "it" && meals.length > 0 ? (
          <button
            type="button"
            onClick={() => setItalian(!italian)}
            aria-pressed={italian}
            className="min-h-11 rounded-full bg-primary-soft px-4 font-semibold text-primary ring-1 ring-line"
          >
            {italian ? t(lang, "mealsShowMine") : t(lang, "mealsShowItalian")}
          </button>
        ) : null}
        {meals.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              // Stamp the time first so the printout shows when it was made.
              flushSync(() => setPrintedAt(new Date().toISOString()));
              window.print();
            }}
            className="min-h-11 rounded-full bg-primary px-4 font-semibold text-white"
          >
            {t(lang, "mealsPrint")}
          </button>
        ) : null}
        {meals.length === 0 ? <p className="rounded-xl bg-white p-4 text-muted ring-1 ring-line">{t(shown, "mealsEmpty")}</p> : null}
        {meals.map((meal) => (
          <MealCard key={meal.mealId} meal={meal} lang={shown} italian={italian} />
        ))}
        <p className="text-sm text-muted">{t(shown, "mealsNotMedical")}</p>
        {meals.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              clearMeals();
              setMeals([]);
            }}
            className="min-h-11 self-start rounded-full px-4 text-sm font-medium text-danger ring-1 ring-line"
          >
            {t(shown, "mealsClear")}
          </button>
        ) : null}
      </main>
      {meals.length > 0 ? <PrintRecord meals={meals} lang={lang} printedAt={printedAt} /> : null}
    </div>
  );
}
