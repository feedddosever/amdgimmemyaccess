"use client";

import { checkDish } from "@/lib/gate";
import { formatReason, lowerFirst, t, type Lang } from "@/lib/i18n";
import type { OrderLine, OrderResult } from "@/lib/order";
import type { DinerProfile, Dish, Menu } from "@/lib/schema";

type Props = {
  menu: Menu;
  profile: DinerProfile;
  cart: OrderLine[];
  lastOrder: OrderResult | null;
  dishName: (dish: Dish) => string;
  onAdd: (line: OrderLine) => void;
  onRemove: (index: number) => void;
  onSend: () => void;
  onBack: () => void;
};

export default function OrderReview({ menu, profile, cart, lastOrder, dishName, onAdd, onRemove, onSend, onBack }: Props) {
  const lang: Lang = profile.lang;
  const dishes = new Map(menu.dishes.map((dish) => [dish.id, dish]));
  // Lines are gated again with the current profile; a blocked line is shown and never sent.
  const lines = cart.map((line) => {
    const dish = dishes.get(line.dishId);
    return { line, dish, result: dish ? checkDish(dish, profile, menu) : null };
  });
  const sendable = lines.filter((entry) => entry.result?.allowed).length;
  const reasonText = (reasons: Parameters<typeof formatReason>[0][]) =>
    reasons.map((reason) => lowerFirst(formatReason(reason, lang, menu), lang)).join("; ");

  return (
    <section className="flex flex-col gap-4" aria-labelledby="review-title">
      <h2 id="review-title" className="text-2xl font-semibold">
        {t(lang, "yourOrder")}
      </h2>

      {lastOrder?.clarifyingQuestion && (
        <p className="rounded-xl bg-amber-50 p-4 font-medium text-amber-900 ring-1 ring-amber-200">{lastOrder.clarifyingQuestion}</p>
      )}

      {cart.length === 0 && <p className="text-muted">{t(lang, "emptyOrder")}</p>}

      <ul className="flex flex-col gap-2">
        {lines.map(({ line, dish, result }, index) =>
          dish ? (
            <li
              key={`${line.dishId}-${index}`}
              className={`rounded-xl p-4 ring-1 ${result?.allowed ? "bg-white ring-line" : "bg-red-50 ring-red-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {line.qty}× {dishName(dish)}
                  </p>
                  {line.forWhom && <p className="text-sm text-muted">{t(lang, "forWhom", { who: line.forWhom })}</p>}
                  {line.noteOriginal && (
                    <p className="text-sm text-muted">
                      {t(lang, "noteLabel")}: {line.noteOriginal}
                    </p>
                  )}
                  {!result?.allowed && result && (
                    <p className="mt-1 text-sm font-medium text-danger">{t(lang, "removed", { reason: reasonText(result.reasons) })}</p>
                  )}
                </div>
                <button type="button" onClick={() => onRemove(index)} className="min-h-11 shrink-0 rounded-full px-3 text-sm text-muted ring-1 ring-line">
                  {t(lang, "remove")}
                </button>
              </div>
            </li>
          ) : null,
        )}
      </ul>

      {lastOrder && lastOrder.removed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lastOrder.removed.map((removed, index) => {
            const dish = dishes.get(removed.dishId);
            if (!dish) return null;
            return (
              <li key={`${removed.dishId}-${index}`} className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
                <p className="font-semibold text-danger line-through decoration-1">{dishName(dish)}</p>
                <p className="text-sm font-medium text-danger">{t(lang, "removed", { reason: reasonText(removed.reasons) })}</p>
                {removed.alternatives.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm">{t(lang, "tryInstead")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {removed.alternatives.map((id) => {
                        const alternative = dishes.get(id);
                        return alternative ? (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onAdd({ dishId: id, qty: removed.qty, ...(removed.forWhom ? { forWhom: removed.forWhom } : {}) })}
                            className="min-h-11 rounded-full bg-olive px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
                          >
                            + {dishName(alternative)}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lastOrder && lastOrder.unmatchedRequests.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-line">
          <p className="font-medium">{t(lang, "notMatched")}</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {lastOrder.unmatchedRequests.map((request) => (
              <li key={request}>{request}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={sendable === 0}
          className="min-h-12 rounded-full bg-terracotta px-6 text-lg font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {t(lang, "sendToKitchen")}
        </button>
        <button type="button" onClick={onBack} className="min-h-11 rounded-full px-6 font-medium text-ink ring-1 ring-line">
          {t(lang, "backToMenu")}
        </button>
      </div>
    </section>
  );
}
