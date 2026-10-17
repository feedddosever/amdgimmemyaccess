"use client";

import { useEffect, useRef, useState } from "react";
import DishCard from "@/components/diner/DishCard";
import OrderBox from "@/components/diner/OrderBox";
import OrderReview from "@/components/diner/OrderReview";
import ProfileSheet from "@/components/diner/ProfileSheet";
import { publish, recordMetas, storeTicket, subscribe } from "@/lib/channel";
import { formatCost, formatLatency } from "@/lib/format";
import { partitionMenu } from "@/lib/gate";
import { LANGS, LANG_NAMES, formatReason, t } from "@/lib/i18n";
import type { LLMMeta } from "@/lib/llm";
import type { OrderLine, OrderResult } from "@/lib/order";
import type { MenuMeta, PersonalizeResponse } from "@/lib/personalize";
import { browserLang, loadStoredProfile, profileFromParams, saveProfile } from "@/lib/profile";
import { AUDIENCES, CATEGORIES, type Audience, type DinerProfile, type Dish, type Menu } from "@/lib/schema";
import { buildTicket, type TicketStatus } from "@/lib/ticket";

type SentTicket = { ticketId: string; status: TicketStatus };
type FooterMeta = Pick<MenuMeta | LLMMeta, "servedFrom" | "latencyMs" | "costEur">;

const OFFLINE_BANNER = "GPU offline - showing results generated earlier on AMD Instinct MI300X";

function initialState() {
  const params = new URLSearchParams(window.location.search);
  return {
    profile: profileFromParams(params) ?? loadStoredProfile(),
    table: params.get("table")?.slice(0, 8) || "1",
  };
}

function mergeLine(cart: OrderLine[], line: OrderLine): OrderLine[] {
  const index = cart.findIndex(
    (existing) => existing.dishId === line.dishId && existing.forWhom === line.forWhom && existing.noteOriginal === line.noteOriginal,
  );
  if (index === -1) return [...cart, line];
  return cart.map((existing, i) => (i === index ? { ...existing, qty: Math.min(existing.qty + line.qty, 10) } : existing));
}

export default function DinerApp({ menu }: { menu: Menu }) {
  const [{ table, profile: startProfile }] = useState(initialState);
  const [profile, setProfile] = useState<DinerProfile | null>(startProfile);
  const [sheetOpen, setSheetOpen] = useState(startProfile === null);
  const [copies, setCopies] = useState<Record<string, PersonalizeResponse | "error">>({});
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [lastOrder, setLastOrder] = useState<OrderResult | null>(null);
  const [view, setView] = useState<"menu" | "order">("menu");
  const [partySize, setPartySize] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [footerMeta, setFooterMeta] = useState<FooterMeta | null>(null);
  const [sent, setSent] = useState<SentTicket[]>([]);
  const requested = useRef(new Set<string>());

  const lang = profile?.lang;
  const audience = profile?.audience;
  const key = lang && audience ? `${lang}|${audience}` : null;

  // One personalize request per language and audience; results are kept, so switching back is instant.
  useEffect(() => {
    if (!key || !lang || !audience || requested.current.has(key)) return;
    requested.current.add(key);
    fetch("/api/personalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ restaurantId: menu.restaurant.id, profile: { lang, audience } }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<PersonalizeResponse>) : Promise.reject(response.status)))
      .then((data) => {
        setCopies((current) => ({ ...current, [key]: data }));
        if (data.meta) setFooterMeta(data.meta);
        recordMetas(data.calls);
      })
      .catch(() => {
        requested.current.delete(key);
        setCopies((current) => ({ ...current, [key]: "error" }));
      });
  }, [key, lang, audience, menu.restaurant.id]);

  // The waiter's choice in the kitchen comes back as a status line.
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type !== "status") return;
        setSent((current) =>
          current.map((ticket) => (ticket.ticketId === message.ticketId ? { ...ticket, status: message.status } : ticket)),
        );
      }),
    [],
  );

  function applyProfile(next: DinerProfile) {
    setProfile(next);
    saveProfile(next);
  }

  if (!profile || !lang) {
    return (
      <ProfileSheet
        restaurant={menu.restaurant.name}
        initial={{ lang: browserLang(), audience: "first_timer", allergens: [], diets: [], excludedIngredientIds: [] }}
        onDone={(next) => {
          applyProfile(next);
          setSheetOpen(false);
        }}
      />
    );
  }

  const current = key ? copies[key] : undefined;
  const personalization = current && current !== "error" ? current : null;
  const dishName = (dish: Dish) => personalization?.dishes[dish.id]?.localizedName ?? dish.nameIt;
  const { allowed, blocked } = partitionMenu(menu, profile);
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const unavailable = current === "error" || personalization?.unavailable;

  async function submitOrder(text: string) {
    if (!profile) return;
    setOrdering(true);
    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId: menu.restaurant.id, profile, text, partySize }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { result, meta } = (await response.json()) as { result: OrderResult; meta: LLMMeta | null };
      applyProfile(result.profile);
      setCart((existing) => result.items.reduce(mergeLine, existing));
      setLastOrder(result);
      if (meta) {
        setFooterMeta(meta);
        recordMetas([meta]);
      }
    } catch {
      setLastOrder({ profile, items: [], removed: [], unmatchedRequests: [], clarifyingQuestion: t(profile.lang, "orderUnavailable") });
    } finally {
      setOrdering(false);
      setView("order");
    }
  }

  function sendToKitchen() {
    if (!profile) return;
    const ticket = buildTicket({
      menu,
      profile,
      lines: cart,
      table,
      partySize,
      ticketId: crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    });
    if (ticket.items.length === 0) return;
    storeTicket(ticket);
    publish({ type: "ticket", ticket });
    setSent((existing) => [{ ticketId: ticket.ticketId, status: ticket.status }, ...existing]);
    setCart([]);
    setLastOrder(null);
    setView("menu");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col" lang={lang}>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-lg font-semibold leading-tight">{menu.restaurant.name}</p>
          <p className="text-sm text-muted">{t(lang, "table", { table })}</p>
        </div>
        <button
          type="button"
          onClick={() => setView(view === "order" ? "menu" : "order")}
          className="min-h-11 shrink-0 rounded-full bg-terracotta px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {view === "order" ? t(lang, "backToMenu") : t(lang, "viewOrder", { count: cartCount })}
        </button>
      </header>

      {/* Profile switcher: changes language and audience live, for the demo. */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <select
          aria-label={t(lang, "language")}
          value={lang}
          onChange={(event) => applyProfile({ ...profile, lang: event.target.value as DinerProfile["lang"] })}
          className="min-h-11 min-w-0 rounded-lg border border-line bg-white px-2"
        >
          {LANGS.map((code) => (
            <option key={code} value={code}>
              {LANG_NAMES[code]}
            </option>
          ))}
        </select>
        <select
          aria-label={t(lang, "whoAreYou")}
          value={profile.audience}
          onChange={(event) => applyProfile({ ...profile, audience: event.target.value as Audience })}
          className="min-h-11 min-w-0 rounded-lg border border-line bg-white px-2"
        >
          {AUDIENCES.map((option) => (
            <option key={option} value={option}>
              {t(lang, `audience_${option}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="col-span-2 min-h-11 rounded-lg border border-line bg-white px-3 font-medium"
        >
          {t(lang, "editProfile")}
          {profile.allergens.length + profile.diets.length > 0 && ` (${profile.allergens.length + profile.diets.length})`}
        </button>
      </div>

      <main className="flex flex-1 flex-col gap-6 px-4 py-5">
        {sent.map((ticket) => (
          <p
            key={ticket.ticketId}
            role="status"
            className={`rounded-xl p-4 font-medium ring-1 ${
              ticket.status === "confirmed"
                ? "bg-green-50 text-green-900 ring-green-200"
                : ticket.status === "to_clarify"
                  ? "bg-amber-50 text-amber-900 ring-amber-200"
                  : "bg-white text-ink ring-line"
            }`}
          >
            {t(lang, `status_${ticket.status}`)}
          </p>
        ))}

        {footerMeta?.servedFrom === "cache" && (
          <p className="rounded-xl bg-ink p-3 text-sm text-white" lang="en">
            {OFFLINE_BANNER}
          </p>
        )}
        {unavailable && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t(lang, "aiUnavailable")}</p>}

        {view === "order" ? (
          <>
            <OrderReview
              menu={menu}
              profile={profile}
              cart={cart}
              lastOrder={lastOrder}
              dishName={dishName}
              onAdd={(line) => setCart((existing) => mergeLine(existing, line))}
              onRemove={(index) => setCart((existing) => existing.filter((_, i) => i !== index))}
              onSend={sendToKitchen}
              onBack={() => setView("menu")}
            />
            <OrderBox lang={lang} partySize={partySize} onPartySize={setPartySize} busy={ordering} onSubmit={submitOrder} />
          </>
        ) : (
          <>
            {menu.restaurant.demoData && (
              <p className="rounded-xl bg-white p-3 text-sm text-muted ring-1 ring-line" lang="en">
                Demo menu: recipes vary; each restaurant approves its own ingredient sheet.
              </p>
            )}
            {CATEGORIES.map((category) => {
              const dishes = allowed.filter((dish) => dish.category === category);
              if (dishes.length === 0) return null;
              return (
                <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-3">
                  <h2 id={`cat-${category}`} className="text-xl font-semibold text-terracotta">
                    {t(lang, `cat_${category}`)}
                  </h2>
                  {dishes.map((dish) => (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      menu={menu}
                      lang={lang}
                      copy={personalization?.dishes[dish.id]}
                      inCart={cart.filter((line) => line.dishId === dish.id).reduce((sum, line) => sum + line.qty, 0)}
                      onAdd={() => setCart((existing) => mergeLine(existing, { dishId: dish.id, qty: 1 }))}
                    />
                  ))}
                </section>
              );
            })}

            {blocked.length > 0 && (
              <details className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <summary className="min-h-11 cursor-pointer content-center font-semibold">
                  {t(lang, "notForYou")} ({blocked.length})
                </summary>
                <ul className="mt-3 flex flex-col gap-3">
                  {blocked.map(({ dish, reasons }) => (
                    <li key={dish.id}>
                      <p className="font-medium">{dishName(dish)}</p>
                      <ul className="text-sm text-danger">
                        {reasons.map((reason, index) => (
                          <li key={index}>{formatReason(reason, lang, menu)}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <OrderBox lang={lang} partySize={partySize} onPartySize={setPartySize} busy={ordering} onSubmit={submitOrder} />
          </>
        )}
      </main>

      <footer className="border-t border-line px-4 py-3 text-center text-xs text-muted" lang="en">
        Gemma 4 on AMD Instinct MI300X
        {footerMeta && (
          <>
            {" "}
            - {formatLatency(footerMeta.latencyMs)} - EUR {formatCost(footerMeta.costEur)}
            {footerMeta.servedFrom !== "live" && ` (${footerMeta.servedFrom})`}
          </>
        )}
      </footer>

      {sheetOpen && (
        <ProfileSheet
          restaurant={menu.restaurant.name}
          initial={profile}
          onDone={(next) => {
            applyProfile(next);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
