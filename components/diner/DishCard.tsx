"use client";

import { useState } from "react";
import { ALLERGEN_NAMES, type AllergenCode } from "@/lib/allergens";
import { formatPrice } from "@/lib/format";
import { allergenSources, dishAllergens } from "@/lib/gate";
import { ASK_STAFF, ingredientName, t, type Lang } from "@/lib/i18n";
import type { DishCopy } from "@/lib/personalize";
import type { Dish, Menu } from "@/lib/schema";

type Props = {
  dish: Dish;
  menu: Menu;
  lang: Lang;
  copy: DishCopy | undefined;
  inCart: number;
  onAdd: () => void;
};

export default function DishCard({ dish, menu, lang, copy, inCart, onAdd }: Props) {
  const [openChip, setOpenChip] = useState<AllergenCode | null>(null);
  const allergens = dishAllergens(dish, menu);
  const sources = allergenSources(dish, menu);
  const name = copy?.localizedName ?? dish.nameIt;
  const showItalianName = name !== dish.nameIt;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div className={copy?.aiGenerated ? "border-l-2 border-accent/40 pl-3" : undefined}>
          <h3 className="text-lg font-semibold leading-snug">{name}</h3>
          {showItalianName && (
            <p className="text-sm italic text-muted" lang="it">
              {dish.nameIt}
            </p>
          )}
          {copy ? (
            <p className="mt-2 leading-relaxed" lang={copy.aiGenerated ? lang : "it"}>
              {copy.explanation}
            </p>
          ) : (
            <p className="mt-2 animate-pulse text-muted">{t(lang, "writingMenu")}</p>
          )}
          {copy?.aiGenerated && (
            <span className="mt-2 inline-block rounded-md bg-paper px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
              {t(lang, "aiGenerated")}
            </span>
          )}
        </div>
        <p className="shrink-0 font-semibold tabular-nums">{formatPrice(dish.priceEur, lang)}</p>
      </div>

      {dish.ownerApproved ? (
        allergens.length > 0 && (
          <div className="mt-3">
            <ul className="flex flex-wrap gap-x-1.5 gap-y-3">
              {allergens.map((code) => (
                <li key={code}>
                  <button
                    type="button"
                    aria-expanded={openChip === code}
                    onClick={() => setOpenChip(openChip === code ? null : code)}
                    className="relative min-h-8 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900 ring-1 ring-amber-200 after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {ALLERGEN_NAMES[code][lang]}
                  </button>
                </li>
              ))}
            </ul>
            {openChip && (
              <p className="mt-2 text-sm text-muted">
                {ALLERGEN_NAMES[openChip][lang]}: {(sources[openChip] ?? []).map((ingredient) => ingredientName(ingredient, lang)).join(", ")}
              </p>
            )}
          </div>
        )
      ) : (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{ASK_STAFF[lang]}</p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          className={`min-h-11 rounded-full px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            inCart > 0 ? "bg-primary text-white" : "bg-primary-soft text-primary ring-1 ring-primary/20"
          }`}
        >
          {inCart > 0 ? `${t(lang, "added")} ×${inCart}` : `+ ${t(lang, "add")}`}
        </button>
      </div>
    </article>
  );
}
