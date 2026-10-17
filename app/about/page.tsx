import Link from "next/link";
import BenchSection from "@/components/BenchSection";
import { QualityCountersLoader } from "@/components/Loaders";
import { getBenchResults } from "@/lib/bench";
import { DEMO_LINKS, PILOT, PRICE_PER_MONTH_EUR, REPO_URL } from "@/lib/site";

export const metadata = {
  title: "How it works – MenuBridge",
  description: "How MenuBridge works, what the model generates and never decides, quality control, cost per experience and the AMD stack.",
};

const FLOW = [
  { title: "Diner on a phone", text: "Scans the QR code, picks a language and any allergies or diet, orders in their own words, and confirms before anything is sent." },
  { title: "MenuBridge app", text: "Next.js on Vercel. Sends the menu data and the order to the model, validates every answer, and logs latency, tokens and euros." },
  { title: "Gemma 4 on AMD Instinct MI300X", text: "vLLM on ROCm, one GPU. Writes dish explanations, maps the order to dish IDs and translates notes into Italian." },
  { title: "Allergen and diet check", text: "Fixed rules, no AI. Every dish is checked against the owner-approved ingredient sheet; unknown dish IDs are dropped and clashes are removed with the reason.", highlight: true },
  { title: "Kitchen ticket", text: "Always in Italian, with the allergy line in red. A waiter confirms at the table and the status goes back to the diner's phone." },
];

const QUALITY = [
  ["Fixed-rule gate", "Allergens and diets are computed from the ingredient sheet by code (lib/gate.ts), never by the model."],
  ["Dish-ID enums", "The model can only name dishes and ingredients that exist: JSON-schema enums in every request, and the server drops unknown IDs."],
  ["zod validation", "Every model answer is validated. On failure it is retried once with the error, then the app falls back to a safe deterministic answer."],
  ["Claim guard", "Descriptions that say “gluten-free”, “safe for”, “vegan” and similar, in 8 languages, are rejected and regenerated once; then the restaurant's Italian text is shown."],
  ["Owner approval", "A dish the owner has not approved shows “Ask staff about allergens” and never passes for a diner who declared an allergy or diet."],
  ["Waiter confirmation", "Every ticket is confirmed at the table before it counts as an order."],
  ["AI labels", "Every AI-written text carries an “AI-generated” label."],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function euro(value: number): string {
  return value < 0.01 ? `€${value.toPrecision(2)}` : `€${value.toFixed(2)}`;
}

export default async function AboutPage() {
  const results = await getBenchResults();
  const reference = results?.levels.find((level) => level.concurrency === 32) ?? results?.levels.at(-1);
  const perViews = reference?.eurPer1000Views ?? null;
  const perOrders = reference?.eurPer1000Orders ?? null;
  const perDiner = perViews !== null && perOrders !== null ? (perViews + perOrders) / 1000 : null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="font-semibold text-accent">MenuBridge · Create a New Kind of Experience</p>
        <h1 className="text-4xl font-semibold tracking-tight">How MenuBridge works</h1>
        <p className="text-lg text-muted">
          A menu that rewrites itself for the person holding it, takes their order in their own words, and hands the
          kitchen a ticket in Italian. This page is also our track compliance statement.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={DEMO_LINKS.japaneseTourist} className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-semibold text-white">
            Try the demo
          </Link>
          <Link href="/demo" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 font-semibold ring-1 ring-line">
            Phone and kitchen side by side
          </Link>
        </div>
      </header>

      <Section id="problem" title="The problem">
        <p>
          Rome had 22.9 million tourist arrivals in 2025. Most of them can&apos;t read an Italian menu, and anyone with an
          allergy has to trust a rushed translation or a busy waiter. Staff spend minutes per foreign table explaining
          dishes, and mistakes reach the kitchen.
        </p>
      </Section>

      <Section id="how" title="How it works">
        <ol className="flex flex-col gap-2">
          {FLOW.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden>
                {index + 1}
              </span>
              <div className={`flex-1 rounded-xl p-4 ring-1 ${step.highlight ? "bg-white ring-2 ring-primary" : "bg-white ring-line"}`}>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted">{step.text}</p>
                {step.highlight && (
                  <p className="mt-2 rounded-lg bg-paper p-2 text-sm">
                    Fed by the <strong>ingredient sheet</strong>: allergens per ingredient, approved by the owner dish by dish.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="created" title="What is created">
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            ["A personal menu", "Written for this diner: their language, and the way a first-timer, a food lover, a family or a diner with dietary needs wants it explained."],
            ["An order", "Taken in the diner's own words, typed or spoken, mapped to real dishes, with clashes removed and safe alternatives offered."],
            ["An Italian kitchen ticket", "Dish names, quantities, who each dish is for, translated notes and the allergy line, confirmed by a waiter."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-xl bg-white p-4 ring-1 ring-line">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="model" title="What the model generates, and what it never decides">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 ring-1 ring-line">
            <h3 className="font-semibold">Gemma 4 generates</h3>
            <ul className="mt-2 list-disc pl-5 text-muted">
              <li>dish names and explanations in 8 languages, styled for 4 audiences</li>
              <li>the mapping from free text to dish IDs</li>
              <li>constraints the diner mentions (&ldquo;no pork&rdquo;, &ldquo;allergic to fish&rdquo;), which only ever add restrictions</li>
              <li>notes translated into Italian for the kitchen</li>
              <li>a draft ingredient sheet when importing a new menu, which the owner must approve</li>
            </ul>
          </div>
          <div className="rounded-xl bg-white p-4 ring-2 ring-primary">
            <h3 className="font-semibold">It never decides</h3>
            <ul className="mt-2 list-disc pl-5 text-muted">
              <li>which allergens a dish contains</li>
              <li>whether a dish fits a diet</li>
              <li>whether a dish is safe for a diner</li>
              <li>what reaches the kitchen: code checks every line again before the ticket is built</li>
            </ul>
            <p className="mt-2 text-sm">Allergens and diets come from fixed rules over the restaurant&apos;s own ingredient sheet.</p>
          </div>
        </div>
      </Section>

      <Section id="quality" title="Quality control">
        <dl className="grid gap-3 sm:grid-cols-2">
          {QUALITY.map(([term, text]) => (
            <div key={term} className="rounded-xl bg-white p-4 ring-1 ring-line">
              <dt className="font-semibold">{term}</dt>
              <dd className="text-muted">{text}</dd>
            </div>
          ))}
        </dl>
        <QualityCountersLoader />
      </Section>

      <Section id="cost" title="Cost per experience">
        {perDiner !== null && perViews !== null && perOrders !== null && reference ? (
          <p>
            One diner&apos;s experience (a personal menu and an order) costs about <strong>{euro(perDiner)}</strong> of GPU
            time on one MI300X at {reference.concurrency} concurrent requests: {euro(perViews)} per 1,000 menu views and{" "}
            {euro(perOrders)} per 1,000 orders. Every model call shows its own cost in the
            app&apos;s footer and in the <Link href="/metrics" className="underline underline-offset-4">AMD panel</Link>.
          </p>
        ) : (
          <p className="text-muted">
            Every model call shows its own cost in the footer and in the{" "}
            <Link href="/metrics" className="underline underline-offset-4">
              AMD panel
            </Link>
            . The per-experience figure appears here once the benchmark below has been run on the MI300X.
          </p>
        )}
      </Section>

      <Section id="who-pays" title="Who pays">
        <p>
          The restaurant pays a monthly subscription; diners pay nothing and install nothing. We will test €
          {PRICE_PER_MONTH_EUR} a month with the pilot.
          {perDiner !== null && (
            <> At 100 diners a day, the GPU cost is about {euro(perDiner * 100 * 30)} a month.</>
          )}{" "}
          The gain for the restaurant: fewer staff minutes per foreign table, fewer order mistakes, and allergen questions
          answered without staff.
        </p>
        <p className="rounded-xl bg-white p-4 ring-1 ring-line">
          <strong>Pilot:</strong>{" "}
          {PILOT.status === "agreed"
            ? `${PILOT.restaurant} has agreed to try MenuBridge free for 30 days.${PILOT.quote ? ` “${PILOT.quote}”` : ""}`
            : "we are asking a trattoria near Link Campus in Rome to try it free for 30 days with its own menu and ingredient sheet."}
        </p>
      </Section>

      <Section id="bench" title="Benchmark on AMD Instinct MI300X">
        <BenchSection results={results} />
      </Section>

      <Section id="stack" title="AMD stack">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ["Model", "google/gemma-4-26B-A4B-it: mixture of experts with about 4B active parameters, so it is fast and fits on one GPU."],
            ["Serving", "vLLM on ROCm (vllm/vllm-openai-rocm image), OpenAI-compatible API with JSON-schema constrained output."],
            ["GPU", "One AMD Instinct MI300X with 192 GB of HBM3, on AMD Developer Cloud."],
            ["Observability", "vLLM's Prometheus metrics and every call's tokens, latency and cost, live in the AMD panel."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-xl bg-white p-4 ring-1 ring-line">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="licence" title="Licence">
        <p>
          MIT licence. Source code:{" "}
          <a href={REPO_URL} className="underline underline-offset-4">
            {REPO_URL.replace("https://", "")}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
