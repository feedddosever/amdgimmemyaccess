import type { LLMMeta } from "@/lib/llm";
import type { Ticket, TicketStatus } from "@/lib/ticket";

// Browser-only: orders move between tabs (diner phone, kitchen, demo screen)
// over BroadcastChannel, and are kept in localStorage so a reload keeps them.

export type ChannelMessage =
  | { type: "ticket"; ticket: Ticket }
  | { type: "status"; ticketId: string; status: TicketStatus }
  | { type: "meta"; metas: LLMMeta[] };

const CHANNEL_NAME = "menubridge";
const TICKETS_KEY = "menubridge:tickets";
const META_KEY = "menubridge:meta-log";
const MAX_TICKETS = 50;
const MAX_METAS = 50;

let channel: BroadcastChannel | null = null;
const listeners = new Set<(message: ChannelMessage) => void>();

function dispatch(message: ChannelMessage) {
  for (const listener of listeners) listener(message);
}

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<ChannelMessage>) => dispatch(event.data);
  }
  return channel;
}

export function subscribe(listener: (message: ChannelMessage) => void): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Reaches other tabs and frames, and listeners in this page too.
export function publish(message: ChannelMessage) {
  getChannel()?.postMessage(message);
  dispatch(message);
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the channel still delivers the message.
  }
}

export function loadTickets(): Ticket[] {
  const tickets = readJSON<unknown>(TICKETS_KEY, []);
  return Array.isArray(tickets) ? (tickets as Ticket[]) : [];
}

export function storeTicket(ticket: Ticket) {
  writeJSON(TICKETS_KEY, [ticket, ...loadTickets().filter((t) => t.ticketId !== ticket.ticketId)].slice(0, MAX_TICKETS));
}

export function storeTicketStatus(ticketId: string, status: TicketStatus) {
  writeJSON(
    TICKETS_KEY,
    loadTickets().map((ticket) => (ticket.ticketId === ticketId ? { ...ticket, status } : ticket)),
  );
}

export function clearTickets() {
  writeJSON(TICKETS_KEY, []);
}

export function loadMetaLog(): LLMMeta[] {
  const metas = readJSON<unknown>(META_KEY, []);
  return Array.isArray(metas) ? (metas as LLMMeta[]) : [];
}

// Every model call's meta goes to the session log for the AMD panel.
export function recordMetas(metas: LLMMeta[]) {
  if (metas.length === 0) return;
  writeJSON(META_KEY, [...loadMetaLog(), ...metas].slice(-MAX_METAS));
  publish({ type: "meta", metas });
}
