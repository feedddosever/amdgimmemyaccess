"use client";

import { useState } from "react";
import { ALLERGEN_CODES, ALLERGEN_NAMES, DIET_CODES, DIET_NAMES } from "@/lib/allergens";
import { LANGS, LANG_NAMES, t } from "@/lib/i18n";
import { AUDIENCES, type DinerProfile } from "@/lib/schema";

type Props = {
  restaurant: string;
  initial: DinerProfile;
  onDone: (profile: DinerProfile) => void;
  onClose?: () => void;
};

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

const chip =
  "min-h-11 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const chipOff = "border-line bg-white text-ink";
const chipOn = "border-primary bg-primary text-white";

export default function ProfileSheet({ restaurant, initial, onDone, onClose }: Props) {
  const [draft, setDraft] = useState(initial);
  const lang = draft.lang;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-labelledby="sheet-title" lang={lang}>
      <form
        className="mx-auto flex max-w-[430px] flex-col gap-6 px-5 py-8"
        onSubmit={(event) => {
          event.preventDefault();
          onDone(draft);
        }}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 id="sheet-title" className="text-2xl font-semibold">
              {t(lang, "welcomeTitle", { restaurant })}
            </h1>
            <p className="mt-2 text-muted">{t(lang, "welcomeIntro")}</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-2xl leading-none text-muted" aria-label="Close">
              ×
            </button>
          )}
        </header>

        <fieldset>
          <legend className="mb-2 font-semibold">{t(lang, "language")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {LANGS.map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={lang === code}
                onClick={() => setDraft({ ...draft, lang: code })}
                className={`${chip} rounded-xl ${lang === code ? chipOn : chipOff}`}
              >
                {LANG_NAMES[code]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">{t(lang, "whoAreYou")}</legend>
          <div className="flex flex-col gap-2">
            {AUDIENCES.map((audience) => (
              <button
                key={audience}
                type="button"
                aria-pressed={draft.audience === audience}
                onClick={() => setDraft({ ...draft, audience })}
                className={`${chip} rounded-xl text-left ${draft.audience === audience ? chipOn : chipOff}`}
              >
                {t(lang, `audience_${audience}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">{t(lang, "allergiesLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {ALLERGEN_CODES.map((code) => {
              const on = draft.allergens.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft({ ...draft, allergens: toggle(draft.allergens, code) })}
                  className={`${chip} ${on ? chipOn : chipOff}`}
                >
                  {ALLERGEN_NAMES[code][lang]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">{t(lang, "dietsLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {DIET_CODES.map((code) => {
              const on = draft.diets.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft({ ...draft, diets: toggle(draft.diets, code) })}
                  className={`${chip} ${on ? chipOn : chipOff}`}
                >
                  {DIET_NAMES[code][lang]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="rounded-xl bg-white p-4 text-sm text-muted ring-1 ring-line">{t(lang, "safetyNote")}</p>

        <button type="submit" className="min-h-12 rounded-full bg-primary px-6 text-lg font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {t(lang, "showMenu")}
        </button>
      </form>
    </div>
  );
}
