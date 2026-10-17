"use client";

import { useState } from "react";
import { ALLERGEN_CODES, ALLERGEN_NAMES, TAG_CODES, TAG_NAMES } from "@/lib/allergens";
import {
  type EditorState,
  type MenuDraft,
  dishDraftAllergens,
  ingredientConfirmed,
  slugify,
  startEditing,
  toMenu,
  uniqueId,
  updateDish,
  updateIngredient,
} from "@/lib/menuDraft";
import { CATEGORIES } from "@/lib/schema";

const PASSCODE_KEY = "menubridge:admin-passcode";
const input = "min-h-11 w-full rounded-lg border border-line bg-white px-3";
const button = "min-h-11 rounded-full px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

function readPasscode(): string {
  try {
    return sessionStorage.getItem(PASSCODE_KEY) ?? "";
  } catch {
    return "";
  }
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function Editor({ state, setState }: { state: EditorState; setState: (next: EditorState) => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const approved = state.dishes.filter((dish) => dish.ownerApproved).length;
  const ingredientName = (id: string) => state.ingredients.find((ingredient) => ingredient.id === id)?.it ?? id;

  function download() {
    const { menu, errors: problems } = toMenu(state);
    setErrors(problems);
    if (!menu) return;
    const blob = new Blob([`${JSON.stringify(menu, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${menu.restaurant.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(menu.restaurant.id);
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="restaurant-title" className="grid gap-3 sm:grid-cols-3">
        <h2 id="restaurant-title" className="text-xl font-semibold sm:col-span-3">
          Restaurant
        </h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input className={input} value={state.restaurant.name} onChange={(e) => setState({ ...state, restaurant: { ...state.restaurant, name: e.target.value } })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Id (the menu URL is /m/id)
          <input
            className={input}
            value={state.restaurant.id}
            onChange={(e) => setState({ ...state, restaurant: { ...state.restaurant, id: slugify(e.target.value).replace(/_/g, "-") } })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          City
          <input className={input} value={state.restaurant.city} onChange={(e) => setState({ ...state, restaurant: { ...state.restaurant, city: e.target.value } })} />
        </label>
      </section>

      <section aria-labelledby="dishes-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="dishes-title" className="text-xl font-semibold">
            Dishes
          </h2>
          <p className="text-sm text-muted">
            {approved} of {state.dishes.length} approved by the owner. Tick a dish only after the owner confirms its ingredients and allergens.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-medium">Owner approved</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Name and description (Italian)</th>
                <th className="px-3 py-2 font-medium">Price €</th>
                <th className="px-3 py-2 font-medium">Ingredients</th>
                <th className="px-3 py-2 font-medium">Allergens (draft)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {state.dishes.map((dish) => (
                <tr key={dish.id} className={`border-b border-line align-top last:border-0 ${dish.ownerApproved ? "bg-green-50" : ""}`}>
                  <td className="px-3 py-2">
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5 accent-green-700"
                        checked={dish.ownerApproved}
                        onChange={(e) => setState(updateDish(state, dish.id, { ownerApproved: e.target.checked }))}
                      />
                      <span className="sr-only">Owner approved {dish.nameIt}</span>
                      {dish.ownerApproved ? "Yes" : "No"}
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Category of ${dish.nameIt}`}
                      className={`${input} min-w-32`}
                      value={dish.category}
                      onChange={(e) => setState(updateDish(state, dish.id, { category: e.target.value as (typeof CATEGORIES)[number] }))}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="flex min-w-64 flex-col gap-1 px-3 py-2">
                    <input aria-label="Italian name" className={input} value={dish.nameIt} onChange={(e) => setState(updateDish(state, dish.id, { nameIt: e.target.value }))} />
                    <textarea
                      aria-label={`Italian description of ${dish.nameIt}`}
                      className="w-full rounded-lg border border-line bg-white p-2"
                      rows={3}
                      value={dish.descriptionIt}
                      onChange={(e) => setState(updateDish(state, dish.id, { descriptionIt: e.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Price of ${dish.nameIt}`}
                      type="number"
                      min="0"
                      step="0.5"
                      className={`${input} w-24 ${dish.priceEur === null ? "border-danger" : ""}`}
                      value={dish.priceEur ?? ""}
                      onChange={(e) => setState(updateDish(state, dish.id, { priceEur: e.target.value === "" ? null : Number(e.target.value) }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ul className="flex flex-wrap gap-1">
                      {dish.ingredientIds.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            title="Remove from this dish"
                            onClick={() => setState(updateDish(state, dish.id, { ingredientIds: dish.ingredientIds.filter((i) => i !== id) }))}
                            className="min-h-8 rounded-full bg-paper px-3 ring-1 ring-line"
                          >
                            {ingredientName(id)} ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <select
                      aria-label={`Add an ingredient to ${dish.nameIt}`}
                      className={`${input} mt-1`}
                      value=""
                      onChange={(e) => e.target.value && setState(updateDish(state, dish.id, { ingredientIds: [...dish.ingredientIds, e.target.value] }))}
                    >
                      <option value="">+ ingredient…</option>
                      {state.ingredients
                        .filter((ingredient) => !dish.ingredientIds.includes(ingredient.id))
                        .map((ingredient) => (
                          <option key={ingredient.id} value={ingredient.id}>
                            {ingredient.it}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <p className={dish.ownerApproved ? "" : "rounded-lg bg-amber-50 p-2 text-amber-900"}>
                      {dishDraftAllergens(state, dish)
                        .map((code) => ALLERGEN_NAMES[code].it)
                        .join(", ") || "none"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setState({ ...state, dishes: state.dishes.filter((d) => d.id !== dish.id) })}
                      className="min-h-11 rounded-full px-3 text-muted ring-1 ring-line"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className={`${button} self-start bg-white ring-1 ring-line`}
          onClick={() => {
            const id = uniqueId("nuovo piatto", state.dishes.map((dish) => dish.id));
            setState({
              ...state,
              dishes: [...state.dishes, { id, category: "secondi", nameIt: "Nuovo piatto", descriptionIt: "Nuovo piatto.", priceEur: null, ingredientIds: [], ownerApproved: false }],
            });
          }}
        >
          + Dish
        </button>
      </section>

      <section aria-labelledby="ingredients-title" className="flex flex-col gap-3">
        <h2 id="ingredients-title" className="text-xl font-semibold">
          Ingredient sheet
        </h2>
        <p className="text-sm text-muted">
          The model only suggests allergens and tags. Each allergen cell stays marked as a draft until every dish using
          that ingredient is approved; changing an ingredient withdraws approval from its dishes.
        </p>
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-medium">Italian</th>
                <th className="px-3 py-2 font-medium">English</th>
                <th className="px-3 py-2 font-medium">Allergeni (EU 14)</th>
                <th className="px-3 py-2 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {state.ingredients.map((ingredient) => {
                const confirmed = ingredientConfirmed(state, ingredient.id);
                return (
                  <tr key={ingredient.id} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-2">
                      <input aria-label="Italian name" className={input} value={ingredient.it} onChange={(e) => setState(updateIngredient(state, ingredient.id, { it: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2">
                      <input aria-label={`English name of ${ingredient.it}`} className={input} value={ingredient.en} onChange={(e) => setState(updateIngredient(state, ingredient.id, { en: e.target.value }))} />
                    </td>
                    <td className={`px-3 py-2 ${confirmed ? "" : "bg-amber-50"}`}>
                      {!confirmed && <p className="mb-1 text-xs font-bold text-amber-900">DRAFT - confirm with the owner</p>}
                      <div className="flex flex-wrap gap-1">
                        {ALLERGEN_CODES.map((code) => {
                          const on = ingredient.allergens.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setState(updateIngredient(state, ingredient.id, { allergens: toggle(ingredient.allergens, code) }))}
                              className={`min-h-8 rounded-full px-2 text-xs ring-1 ${on ? "bg-danger text-white ring-danger" : "bg-white text-muted ring-line"}`}
                            >
                              {ALLERGEN_NAMES[code].it}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {TAG_CODES.map((tag) => {
                          const on = ingredient.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setState(updateIngredient(state, ingredient.id, { tags: toggle(ingredient.tags, tag) }))}
                              className={`min-h-8 rounded-full px-2 text-xs ring-1 ${on ? "bg-ink text-white ring-ink" : "bg-white text-muted ring-line"}`}
                            >
                              {TAG_NAMES[tag].it}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className={`${button} self-start bg-white ring-1 ring-line`}
          onClick={() => {
            const name = window.prompt("Italian name of the ingredient")?.trim();
            if (!name) return;
            const id = uniqueId(name, state.ingredients.map((ingredient) => ingredient.id));
            setState({ ...state, ingredients: [...state.ingredients, { id, it: name, en: name, allergens: [], tags: [] }] });
          }}
        >
          + Ingredient
        </button>
      </section>

      <section aria-labelledby="export-title" className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-line">
        <h2 id="export-title" className="text-xl font-semibold">
          Save the menu
        </h2>
        <p className="text-sm text-muted">
          Vercel cannot write files, so download the JSON, save it as <code className="font-mono">data/{state.restaurant.id || "<id>"}.json</code>, commit and
          deploy. Unapproved dishes show &ldquo;Ask staff about allergens&rdquo; and are hidden from any diner who declares an allergy or a diet.
        </p>
        <button type="button" onClick={download} className={`${button} self-start bg-terracotta text-white`}>
          Download JSON
        </button>
        {errors.length > 0 && (
          <ul className="list-disc rounded-lg bg-red-50 p-3 pl-8 text-sm text-danger" role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        {downloaded && errors.length === 0 && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
            Downloaded {downloaded}.json. After you commit it as data/{downloaded}.json and deploy, the menu is at /m/{downloaded}.
          </p>
        )}
      </section>
    </div>
  );
}

export default function ImportApp() {
  const [passcode, setPasscode] = useState(readPasscode);
  const [unlocked, setUnlocked] = useState(false);
  const [restaurant, setRestaurant] = useState({ id: "", name: "", city: "Roma" });
  const [menuText, setMenuText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EditorState | null>(null);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!body.ok) return setError(body.error ?? "Could not check the passcode.");
    try {
      sessionStorage.setItem(PASSCODE_KEY, passcode);
    } catch {
      // Without sessionStorage the passcode is asked again next visit.
    }
    setUnlocked(true);
  }

  async function draft(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode, menuText }),
      });
      const body = (await response.json().catch(() => ({}))) as { draft?: MenuDraft; error?: string };
      if (!body.draft) return setError(body.error ?? "The draft failed.");
      setState(startEditing(body.draft, { ...restaurant, id: restaurant.id || slugify(restaurant.name).replace(/_/g, "-") }));
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked) {
    return (
      <form onSubmit={unlock} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 font-medium">
          Admin passcode
          <input type="password" autoComplete="current-password" className={input} value={passcode} onChange={(e) => setPasscode(e.target.value)} />
        </label>
        <button type="submit" className={`${button} bg-terracotta text-white`}>
          Unlock
        </button>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </form>
    );
  }

  if (state) return <Editor state={state} setState={setState} />;

  return (
    <form onSubmit={draft} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Restaurant name
          <input required className={input} value={restaurant.name} onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Id (optional, from the name)
          <input
            className={input}
            placeholder={slugify(restaurant.name).replace(/_/g, "-")}
            value={restaurant.id}
            onChange={(e) => setRestaurant({ ...restaurant, id: slugify(e.target.value).replace(/_/g, "-") })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          City
          <input required className={input} value={restaurant.city} onChange={(e) => setRestaurant({ ...restaurant, city: e.target.value })} />
        </label>
      </div>
      <label className="flex flex-col gap-1 font-medium">
        The restaurant&apos;s menu, in Italian, as printed
        <textarea
          required
          rows={14}
          value={menuText}
          onChange={(e) => setMenuText(e.target.value)}
          placeholder={"PRIMI\nSpaghetti alla carbonara (guanciale, uovo, pecorino) 13\n…"}
          className="w-full rounded-xl border border-line bg-white p-3 font-mono text-sm"
        />
      </label>
      <button type="submit" disabled={busy} className={`${button} self-start bg-terracotta text-white disabled:opacity-50`}>
        {busy ? "Drafting with Gemma 4…" : "Draft the menu"}
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
