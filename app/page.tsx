import Link from "next/link";
import { DEMO_LINKS, REPO_URL } from "@/lib/site";

const primary =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta px-6 text-center font-semibold text-white";
const secondary =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-center font-semibold text-ink ring-1 ring-line";

const STEPS = [
  {
    title: "Scan",
    text: "The diner scans the QR code on the table and picks their language, who they are, and any allergies or diet.",
  },
  {
    title: "Read and order",
    text: "The menu rewrites itself for them, and they order in their own words. A dish that clashes with an allergy or diet is removed, with the reason.",
  },
  {
    title: "The kitchen gets Italian",
    text: "The kitchen gets a ticket in Italian with the allergy line in red, and a waiter confirms it at the table.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 py-12 sm:px-6 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <p className="font-semibold tracking-wide text-terracotta">MenuBridge</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Order in your language. The kitchen gets it in theirs.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            A QR menu that rewrites itself for each diner, blocks any dish that clashes with their allergies or diet
            using fixed rules, and sends the kitchen a ticket in Italian. Gemma 4 does the language work on an AMD
            Instinct MI300X.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={DEMO_LINKS.japaneseTourist} className={primary}>
              Try as a tourist from Japan
            </Link>
            <Link href={DEMO_LINKS.fishAllergy} className={primary}>
              Try with a fish allergy
            </Link>
            <Link href="/kitchen" className={secondary}>
              Open the kitchen
            </Link>
            <Link href="/about" className={secondary}>
              How it works
            </Link>
          </div>
        </div>

        <figure className="flex flex-col gap-3" aria-label="Example: the diner's phone and the kitchen ticket">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line" lang="ja">
            <p className="text-xs text-muted">Phone · 日本語 · 「ローマらしい料理を。でも豚肉は抜きで。」</p>
            <div className="mt-2 rounded-lg bg-red-50 p-3">
              <p className="font-semibold text-danger line-through decoration-1">スパゲッティ・アッラ・カルボナーラ</p>
              <p className="text-sm font-medium text-danger">除外：cured pork cheek（豚肉）を含みます</p>
            </div>
            <p className="mt-3 inline-flex rounded-full bg-olive px-4 py-2 text-sm font-semibold text-white">+ トンナレッリ・カチョ・エ・ペペ</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line" lang="it">
            <p className="text-xs text-muted">Cucina · Tavolo 7 · Cliente: giapponese</p>
            <p className="mt-1 font-bold">DIETA: SENZA MAIALE</p>
            <p className="mt-1 font-semibold">1× Tonnarelli cacio e pepe</p>
            <p className="text-sm">per bambino, 6 anni</p>
          </div>
        </figure>
      </section>

      <section aria-labelledby="steps-title" className="flex flex-col gap-5">
        <h2 id="steps-title" className="text-2xl font-semibold">
          Three steps
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-2xl bg-white p-5 ring-1 ring-line">
              <span className="flex size-9 items-center justify-center rounded-full bg-terracotta font-semibold text-white" aria-hidden>
                {index + 1}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold">The AI never decides what is safe.</span>{" "}
          <span className="text-white/80">Allergens and diets come from the restaurant&apos;s own ingredient sheet, checked by fixed rules.</span>
        </p>
        <Link href="/demo" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 py-2 text-center font-semibold leading-tight text-ink">
          See phone and kitchen side by side
        </Link>
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm text-muted">
        <Link href="/metrics" className="inline-flex min-h-11 items-center underline underline-offset-4">
          AMD panel
        </Link>
        <Link href="/about" className="inline-flex min-h-11 items-center underline underline-offset-4">
          Track compliance
        </Link>
        <a href={REPO_URL} className="inline-flex min-h-11 items-center underline underline-offset-4">
          Source code (MIT)
        </a>
      </footer>
    </main>
  );
}
