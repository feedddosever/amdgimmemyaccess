"use client";

import { useState } from "react";
import MicButton from "@/components/diner/MicButton";
import { t, type Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  partySize: number;
  onPartySize: (size: number) => void;
  busy: boolean;
  onSubmit: (text: string) => void;
};

export default function OrderBox({ lang, partySize, onPartySize, busy, onSubmit }: Props) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim() && !busy) onSubmit(text.trim());
      }}
    >
      <label htmlFor="order-text" className="text-lg font-semibold">
        {t(lang, "orderTitle")}
      </label>
      <textarea
        id="order-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t(lang, "orderPlaceholder")}
        rows={3}
        maxLength={1000}
        className="w-full resize-y rounded-xl border border-line bg-paper p-3 text-base focus-visible:outline-2 focus-visible:outline-terracotta"
      />
      <div className="flex flex-wrap items-center gap-3">
        <MicButton lang={lang} onText={(spoken) => setText((current) => (current ? `${current} ${spoken}` : spoken))} />
        <label className="flex items-center gap-2 text-sm">
          {t(lang, "partySize")}
          <select
            value={partySize}
            onChange={(event) => onPartySize(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-line bg-white px-2"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="min-h-12 rounded-full bg-terracotta px-6 font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        {busy ? t(lang, "checking") : t(lang, "checkOrder")}
      </button>
    </form>
  );
}
