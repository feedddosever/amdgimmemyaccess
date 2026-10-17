// Saves the live model's answers for the demo into data/cache, so the demo keeps
// working when the GPU is off ("GPU offline - showing results generated earlier").
//   npm run warm-cache        then commit data/cache
// Covers personalize for the demo menu (4 audiences × it, en, de, ja) and the
// orders of the 4 /demo preset diners.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cacheDir } from "@/lib/cache";
import { config } from "@/lib/config";
import type { LLMMeta } from "@/lib/llm";
import { takeOrder } from "@/lib/order";
import { personalizeMenu } from "@/lib/personalize";
import { AUDIENCES, DinerProfileSchema, MenuSchema } from "@/lib/schema";
import { DEMO_PRESETS } from "@/lib/site";
import { loadEnvFiles } from "./env";

const LANGS = ["it", "en", "de", "ja"] as const;

async function main() {
  loadEnvFiles();
  process.env.CACHE_WRITE = "1";
  const cfg = config();
  if (cfg.mock || !cfg.baseURL) {
    console.error("warm-cache needs the live model: set MOCK_LLM=0 and LLM_BASE_URL (in .env.local or the environment).");
    process.exit(1);
  }
  const menu = MenuSchema.parse(JSON.parse(readFileSync(path.join("data", "demo-trattoria.json"), "utf8")));
  console.log(`Saving demo outputs from ${cfg.model} into ${cacheDir()}`);
  const calls: LLMMeta[] = [];
  let failures = 0;

  for (const lang of LANGS) {
    for (const audience of AUDIENCES) {
      const view = await personalizeMenu(menu, { lang, audience });
      calls.push(...view.calls);
      const live = view.calls.filter((call) => call.servedFrom === "live").length;
      if (view.unavailable || live < view.calls.length) failures++;
      console.log(`  menu ${lang}/${audience}: ${live}/${view.calls.length} live calls, ${view.meta?.qualityRejections ?? 0} claim rejections`);
    }
  }

  for (const preset of DEMO_PRESETS) {
    const profile = DinerProfileSchema.parse(preset.profile);
    const { result, meta } = await takeOrder(menu, profile, preset.order, 1);
    if (meta) calls.push(meta);
    if (!meta || meta.servedFrom !== "live") failures++;
    console.log(
      `  order ${preset.label}: ${result.items.length} items, ${result.removed.length} removed${meta ? ` (${meta.servedFrom})` : " (model unreachable)"}`,
    );
  }

  const tokens = calls.reduce((sum, call) => sum + call.promptTokens + call.completionTokens, 0);
  console.log(`\n${calls.length} model calls, ${tokens.toLocaleString("en")} tokens.`);
  if (failures > 0) {
    console.error(`${failures} views or orders did not come live from the model; run again before committing.`);
    process.exit(1);
  }
  console.log("Done. Commit data/cache so Vercel can serve these when the GPU is off.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
