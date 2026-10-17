// Checks the model endpoint in .env.local before Vercel is pointed at it: is the key
// accepted, which models are served, and do one real menu and one real order work
// through the app's own code (validation, retry, the allergen and diet gate).
//   npm run llm-check
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { formatReason } from "@/lib/i18n";
import type { LLMMeta } from "@/lib/llm";
import { takeOrder } from "@/lib/order";
import { personalizeMenu } from "@/lib/personalize";
import { DinerProfileSchema, MenuSchema } from "@/lib/schema";
import { DEMO_PRESETS } from "@/lib/site";
import { loadEnvFiles } from "./env";

async function listModels(baseURL: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${baseURL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`The endpoint rejected the key (HTTP ${response.status}). Check LLM_API_KEY.`);
  }
  if (!response.ok) {
    throw new Error(`GET ${baseURL}/models answered HTTP ${response.status}. LLM_BASE_URL is probably wrong; it usually ends in /v1.`);
  }
  const body = (await response.json()) as { data?: { id?: string }[] };
  return (body.data ?? []).flatMap((model) => (model.id ? [model.id] : []));
}

const describe = (call: LLMMeta) =>
  `${call.servedFrom}, ${call.latencyMs} ms, ${call.completionTokens} tokens, ${Math.round(call.tokensPerSec)} tok/s` +
  (call.validationRetries ? ", 1 validation retry" : "");

async function main() {
  loadEnvFiles();
  const cfg = config();
  if (!cfg.baseURL || !cfg.apiKey) {
    console.error("Set LLM_BASE_URL and LLM_API_KEY in .env.local first (copy .env.example).");
    process.exit(1);
  }
  console.log(`Endpoint: ${cfg.baseURL}`);
  const models = await listModels(cfg.baseURL, cfg.apiKey);
  console.log(`Key accepted. ${models.length} models served:`);
  for (const id of models) console.log(`  ${id}${id === cfg.model ? "   <- LLM_MODEL" : /gemma/i.test(id) ? "   <- Gemma" : ""}`);
  if (!models.includes(cfg.model)) {
    console.error(`\nLLM_MODEL=${cfg.model} is not served here. Set LLM_MODEL to one of the IDs above (a Gemma one if listed) and run again.`);
    process.exit(1);
  }

  // The rest goes through the app's own code, against the live model.
  process.env.MOCK_LLM = "0";
  const menu = MenuSchema.parse(JSON.parse(readFileSync(path.join("data", "demo-trattoria.json"), "utf8")));
  console.log("\nMenu for a Japanese first-timer:");
  const view = await personalizeMenu(menu, { lang: "ja", audience: "first_timer" });
  for (const call of view.calls) console.log(`  ${call.task}: ${describe(call)}`);
  const carbonara = view.dishes.carbonara;
  if (carbonara) console.log(`  carbonara: ${carbonara.localizedName}: ${carbonara.explanation}`);

  const preset = DEMO_PRESETS[0];
  const profile = DinerProfileSchema.parse(preset.profile);
  console.log(`\nOrder: ${preset.order}`);
  const { result, meta } = await takeOrder(menu, profile, preset.order, 1);
  if (meta) console.log(`  ${describe(meta)}`);
  for (const line of result.items) console.log(`  kept: ${line.qty}× ${line.dishId}${line.forWhom ? ` (${line.forWhom})` : ""}`);
  for (const line of result.removed) {
    console.log(`  removed: ${line.dishId}: ${line.reasons.map((reason) => formatReason(reason, profile.lang, menu)).join("; ")}`);
  }

  const calls = [...view.calls, ...(meta ? [meta] : [])];
  const live = calls.filter((call) => call.servedFrom === "live").length;
  if (live < calls.length || view.unavailable) {
    console.error(`\n${calls.length - live} of ${calls.length} calls did not come live from the model. Fix that before going live.`);
    process.exit(1);
  }
  console.log(`\nAll ${calls.length} calls came live from ${cfg.model}. Set the same values on Vercel with MOCK_LLM=0.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
