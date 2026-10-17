// Load test of the live model endpoint with the app's own requests.
//   npm run bench                         4 levels × 60 s against LLM_BASE_URL
//   npm run bench -- --duration 10 --levels 1,8
// Reads .env.local / .env. Writes bench/results.json and bench/results.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ZodType } from "zod";
import { type BenchLevel, type BenchResults, benchMarkdown, eurPer1000, percentile, withBenchSection } from "@/lib/bench";
import { config } from "@/lib/config";
import { LANGS } from "@/lib/i18n";
import { GPU_NAME, complete, createClient, prepareRequest, validate } from "@/lib/llm";
import { orderRequest } from "@/lib/order";
import { personalizeRequest } from "@/lib/personalize";
import { AUDIENCES, CATEGORIES, type DinerProfile, MenuSchema } from "@/lib/schema";
import { loadEnvFiles } from "./env";

// Two orders in each of it, en, de, fr, ja, zh.
const ORDERS: { lang: DinerProfile["lang"]; text: string }[] = [
  { lang: "it", text: "Una carbonara e un tiramisù, per favore." },
  { lang: "it", text: "Per me qualcosa di vegetariano e per il bambino una pasta semplice." },
  { lang: "en", text: "Two cacio e pepe and the lamb chops, please." },
  { lang: "en", text: "I'm allergic to fish. Something typically Roman, and a dessert to share." },
  { lang: "de", text: "Einmal Saltimbocca und für mein Kind etwas Einfaches, bitte." },
  { lang: "de", text: "Ich esse kein Schweinefleisch. Was empfehlen Sie als Hauptgericht?" },
  { lang: "fr", text: "Une amatriciana et des artichauts à la juive, s'il vous plaît." },
  { lang: "fr", text: "Je suis végétarien : une entrée et des pâtes, merci." },
  { lang: "ja", text: "ローマらしい料理をお願いします。でも豚肉は抜きで。6歳の子どもにはシンプルなものを。" },
  { lang: "ja", text: "カルボナーラを2つとティラミスをください。" },
  { lang: "zh", text: "我想要一份罗马特色意面，不要猪肉。" },
  { lang: "zh", text: "我对鸡蛋过敏，请推荐一道主菜和一道配菜。" },
];

type Sample = { task: string; ok: boolean; latencyMs: number; promptTokens: number; completionTokens: number; valid: boolean; error?: string };

function parseArgs(argv: string[]) {
  const value = (name: string) => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  return {
    durationSec: Number(value("duration") ?? 60),
    levels: (value("levels") ?? "1,8,32,64").split(",").map(Number),
    out: value("out") ?? "bench",
  };
}

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const cfg = config();
  if (!cfg.baseURL) {
    console.error("LLM_BASE_URL is not set (in the environment, .env.local or .env).");
    process.exit(1);
  }
  const menu = MenuSchema.parse(JSON.parse(readFileSync(path.join("data", "demo-trattoria.json"), "utf8")));
  const categories = CATEGORIES.map((category) => menu.dishes.filter((dish) => dish.category === category)).filter((dishes) => dishes.length > 0);
  const client = createClient();

  // A diner's visit is one menu view (one call per category) and one order.
  function nextRequest(): { task: string; system: string; user: string; schema: ZodType; maxTokens: number; temperature: number } {
    if (Math.random() < categories.length / (categories.length + 1)) {
      return personalizeRequest(menu, pick(categories), { lang: pick(LANGS), audience: pick(AUDIENCES) });
    }
    const order = pick(ORDERS);
    const profile: DinerProfile = { lang: order.lang, audience: "first_timer", allergens: [], diets: [], excludedIngredientIds: [] };
    return orderRequest(menu, profile, order.text, 2);
  }

  async function send(): Promise<Sample> {
    const request = nextRequest();
    const { jsonSchema, messages } = prepareRequest(request);
    const startedAt = performance.now();
    try {
      const reply = await complete(
        client,
        { model: cfg.model, messages, jsonSchema, task: request.task, maxTokens: request.maxTokens, temperature: request.temperature },
        Date.now() + 120_000,
      );
      return {
        task: request.task,
        ok: true,
        latencyMs: performance.now() - startedAt,
        ...reply.usage,
        valid: validate(reply.text, request.schema).ok,
      };
    } catch (error) {
      return { task: request.task, ok: false, latencyMs: performance.now() - startedAt, promptTokens: 0, completionTokens: 0, valid: false, error: String(error) };
    }
  }

  async function runLevel(concurrency: number): Promise<{ samples: Sample[]; elapsedSec: number }> {
    const samples: Sample[] = [];
    const start = performance.now();
    const end = start + args.durationSec * 1000;
    const worker = async () => {
      while (performance.now() < end) {
        const sample = await send();
        samples.push(sample);
        if (!sample.ok) await sleep(500);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { samples, elapsedSec: (performance.now() - start) / 1000 };
  }

  const server = await fetch(`${cfg.baseURL.replace(/\/v1$/, "")}/version`, { signal: AbortSignal.timeout(3_000) })
    .then((response) => (response.ok ? (response.json() as Promise<{ version?: string }>) : {}))
    .then((body: { version?: string }) => (body.version ? `vLLM ${body.version}` : "vLLM"))
    .catch(() => "vLLM");

  console.log(`Benchmarking ${cfg.model} at ${new URL(cfg.baseURL).host}: levels ${args.levels.join(", ")}, ${args.durationSec} s each.`);
  const runs: { concurrency: number; samples: Sample[]; elapsedSec: number }[] = [];
  for (const concurrency of args.levels) {
    process.stdout.write(`  concurrency ${concurrency}… `);
    const run = await runLevel(concurrency);
    const ok = run.samples.filter((sample) => sample.ok).length;
    console.log(`${ok} ok, ${run.samples.length - ok} errors`);
    if (ok === 0) {
      console.error(`Every request failed. First error: ${run.samples[0]?.error ?? "none"}`);
      process.exit(1);
    }
    runs.push({ concurrency, ...run });
  }

  const succeeded = runs.flatMap((run) => run.samples.filter((sample) => sample.ok));
  const meanTokens = (task: string) => {
    const tokens = succeeded.filter((sample) => sample.task === task).map((sample) => sample.promptTokens + sample.completionTokens);
    return tokens.length ? tokens.reduce((sum, value) => sum + value, 0) / tokens.length : null;
  };
  const perPersonalize = meanTokens("personalize");
  const tokensPerView = perPersonalize === null ? null : perPersonalize * categories.length;
  const tokensPerOrder = meanTokens("order");

  const levels: BenchLevel[] = runs.map(({ concurrency, samples, elapsedSec }) => {
    const ok = samples.filter((sample) => sample.ok);
    const latencies = ok.map((sample) => sample.latencyMs);
    const outputTokensPerSec = ok.reduce((sum, sample) => sum + sample.completionTokens, 0) / elapsedSec;
    return {
      concurrency,
      requests: ok.length,
      errors: samples.length - ok.length,
      requestsPerSec: ok.length / elapsedSec,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      outputTokensPerSec,
      errorRate: samples.length ? (samples.length - ok.length) / samples.length : 0,
      validRate: ok.length ? ok.filter((sample) => sample.valid).length / ok.length : null,
      eurPer1000Views: eurPer1000(tokensPerView, outputTokensPerSec, cfg.gpuHourlyUsd, cfg.eurPerUsd),
      eurPer1000Orders: eurPer1000(tokensPerOrder, outputTokensPerSec, cfg.gpuHourlyUsd, cfg.eurPerUsd),
    };
  });

  // The app prices calls at the throughput measured at concurrency 32 (or the nearest level run).
  const reference = levels.find((level) => level.concurrency === 32) ?? levels.at(-1);
  const results: BenchResults = {
    runAt: new Date().toISOString(),
    model: cfg.model,
    gpu: GPU_NAME,
    server,
    durationSec: args.durationSec,
    gpuHourlyUsd: cfg.gpuHourlyUsd,
    eurPerUsd: cfg.eurPerUsd,
    callsPerView: categories.length,
    tokensPerView,
    tokensPerOrder,
    levels,
    benchTokensPerSec: reference ? Math.round(reference.outputTokensPerSec) : null,
  };

  mkdirSync(args.out, { recursive: true });
  writeFileSync(path.join(args.out, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const markdown = benchMarkdown(results);
  writeFileSync(path.join(args.out, "results.md"), markdown);
  console.log(`\n${markdown}`);
  console.log(`Wrote ${path.join(args.out, "results.json")} and results.md.`);
  if (args.out === "bench" && existsSync("README.md")) {
    writeFileSync("README.md", withBenchSection(readFileSync("README.md", "utf8"), results));
    console.log("Updated the benchmark table in README.md.");
  }
  console.log(`Set BENCH_TOKENS_PER_SEC=${results.benchTokensPerSec} (throughput at concurrency ${reference?.concurrency}) in Vercel and .env.local.`);
  if (cfg.gpuHourlyUsd === null || cfg.eurPerUsd === null) console.log("Set GPU_HOURLY_USD and EUR_PER_USD to get the EUR columns.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
