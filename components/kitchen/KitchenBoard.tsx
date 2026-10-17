"use client";

import { useEffect, useRef, useState } from "react";
import { clearTickets, loadTickets, publish, storeTicketStatus, subscribe } from "@/lib/channel";
import { KITCHEN, LANG_NAMES_IT, fillTemplate } from "@/lib/i18n";
import type { Ticket, TicketStatus } from "@/lib/ticket";

// A short two-note chime from the Web Audio API; browsers only allow it after a click.
function chime(context: AudioContext | null) {
  if (!context || context.state !== "running") return;
  [880, 1175].forEach((frequency, i) => {
    const start = context.currentTime + i * 0.18;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.4);
  });
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  new: "bg-accent text-white",
  confirmed: "bg-green-700 text-white",
  to_clarify: "bg-amber-500 text-ink",
};

function TicketCard({ ticket, onStatus, compact }: { ticket: Ticket; onStatus: (status: TicketStatus) => void; compact: boolean }) {
  const time = new Date(ticket.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const size = compact ? "text-lg" : "text-2xl";
  return (
    <article className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${ticket.status === "new" ? "ring-accent" : "ring-line"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`${size} font-bold`}>{fillTemplate(KITCHEN.table, { table: ticket.table })}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[ticket.status]}`}>{KITCHEN[`status_${ticket.status}`]}</span>
      </header>
      <p className="mt-1 text-muted">
        {time} · {fillTemplate(KITCHEN.covers, { n: String(ticket.partySize) })} · {fillTemplate(KITCHEN.customer, { lang: LANG_NAMES_IT[ticket.dinerLang] })}
      </p>

      {ticket.dinerAllergiesIt.length > 0 && (
        <p className={`mt-3 rounded-lg bg-red-50 px-3 py-2 ${size} font-bold text-danger`}>
          {fillTemplate(KITCHEN.allergy, { list: ticket.dinerAllergiesIt.join(", ").toUpperCase() })}
        </p>
      )}
      {ticket.dinerDietsIt.length > 0 && (
        <p className="mt-2 font-semibold">{fillTemplate(KITCHEN.diet, { list: ticket.dinerDietsIt.join(", ").toUpperCase() })}</p>
      )}
      {ticket.dinerExcludedIt.length > 0 && (
        <p className="mt-2 font-semibold">{fillTemplate(KITCHEN.without, { list: ticket.dinerExcludedIt.join(", ").toUpperCase() })}</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {ticket.items.map((item, index) => (
          <li key={index} className="border-t border-line pt-3">
            <p className={`${size} font-semibold`}>
              {item.qty}× {item.nameIt}
            </p>
            {item.forWhom && <p className="text-lg">{fillTemplate(KITCHEN.forWhom, { who: item.forWhom })}</p>}
            {item.noteItalian && (
              <p className="text-lg">
                “{item.noteItalian}” <span className="text-sm text-muted">({KITCHEN.translatedNote})</span>
              </p>
            )}
            {item.allergenFlagsIt.length > 0 && (
              <p className="text-sm text-muted">{fillTemplate(KITCHEN.allergens, { list: item.allergenFlagsIt.join(", ") })}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStatus("confirmed")}
          className="min-h-12 flex-1 rounded-xl bg-green-700 px-4 text-lg font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
        >
          {KITCHEN.confirm}
        </button>
        <button
          type="button"
          onClick={() => onStatus("to_clarify")}
          className="min-h-12 flex-1 rounded-xl bg-amber-400 px-4 text-lg font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {KITCHEN.clarify}
        </button>
      </div>
    </article>
  );
}

export default function KitchenBoard({ compact = false }: { compact?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>(loadTickets);
  const [soundOn, setSoundOn] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === "ticket") {
          setTickets((current) => [message.ticket, ...current.filter((t) => t.ticketId !== message.ticket.ticketId)]);
          chime(audio.current);
        } else if (message.type === "status") {
          setTickets((current) => current.map((t) => (t.ticketId === message.ticketId ? { ...t, status: message.status } : t)));
        }
      }),
    [],
  );

  function setStatus(ticketId: string, status: TicketStatus) {
    storeTicketStatus(ticketId, status);
    publish({ type: "status", ticketId, status });
  }

  async function enableSound() {
    audio.current ??= new AudioContext();
    await audio.current.resume();
    setSoundOn(true);
    chime(audio.current);
  }

  const sorted = [...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section lang="it" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${compact ? "text-2xl" : "text-4xl"} font-bold`}>{KITCHEN.title}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={enableSound} aria-pressed={soundOn} className="min-h-11 rounded-full bg-white px-4 font-medium ring-1 ring-line">
            🔔 {soundOn ? KITCHEN.soundOn : KITCHEN.sound}
          </button>
          <button
            type="button"
            onClick={() => {
              clearTickets();
              setTickets([]);
            }}
            className="min-h-11 rounded-full bg-white px-4 font-medium text-muted ring-1 ring-line"
          >
            {KITCHEN.clear}
          </button>
        </div>
      </header>
      {sorted.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-lg text-muted ring-1 ring-line">{KITCHEN.empty}</p>
      ) : (
        <div className={compact ? "flex flex-col gap-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
          {sorted.map((ticket) => (
            <TicketCard key={ticket.ticketId} ticket={ticket} compact={compact} onStatus={(status) => setStatus(ticket.ticketId, status)} />
          ))}
        </div>
      )}
    </section>
  );
}
