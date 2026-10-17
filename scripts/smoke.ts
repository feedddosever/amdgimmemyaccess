// Smoke test of a running MenuBridge.
//   npm run smoke -- https://your-app.vercel.app             the live model is expected
//   npm run smoke -- https://your-app.vercel.app --offline   GPU off: saved answers and the banner
//   npm run smoke -- http://localhost:3000 --mock            MOCK_LLM=1
import { DEMO_LINKS, DEMO_PRESETS } from "@/lib/site";

type Expect = "live" | "cache" | "mock";

async function main() {
  const base = process.argv[2]?.replace(/\/+$/, "");
  if (!base?.startsWith("http")) {
    console.error("Usage: npm run smoke -- <url> [--offline | --mock]");
    process.exit(1);
  }
  const expect: Expect = process.argv.includes("--offline") ? "cache" : process.argv.includes("--mock") ? "mock" : "live";
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    if (!ok) failures.push(name);
  };
  const get = (path: string) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000) });
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65_000),
    });
    return (await response.json()) as Record<string, unknown>;
  };

  console.log(`Smoke test of ${base}, expecting model answers from: ${expect}\n`);

  for (const path of ["/", DEMO_LINKS.japaneseTourist, DEMO_LINKS.fishAllergy, "/kitchen", "/demo", "/metrics", "/about"]) {
    const response = await get(path).catch(() => null);
    check(`page ${path}`, response?.status === 200, String(response?.status ?? "no response"));
  }

  const health = (await (await get("/api/health")).json()) as { status: string; model: string };
  const healthExpected = { live: "live", cache: "offline", mock: "mock" }[expect];
  check(`health is ${healthExpected}`, health.status === healthExpected, `${health.status}, ${health.model}`);

  const menu = (await post("/api/personalize", {
    restaurantId: "demo-trattoria",
    profile: { lang: "ja", audience: "first_timer" },
  })) as { dishes?: Record<string, { aiGenerated: boolean }>; meta?: { servedFrom: string; latencyMs: number; costEur: number | null } | null };
  const copies = Object.values(menu.dishes ?? {});
  check("menu has all 13 dishes", copies.length === 13, String(copies.length));
  check("menu is AI-written in Japanese", copies.filter((copy) => copy.aiGenerated).length >= 10, `${copies.filter((c) => c.aiGenerated).length} AI texts`);
  check(
    `menu served from ${expect}${expect === "cache" ? " (the app shows the GPU offline banner)" : ""}`,
    menu.meta?.servedFrom === expect,
    menu.meta ? `${menu.meta.servedFrom}, ${menu.meta.latencyMs} ms, EUR ${menu.meta.costEur ?? "–"}` : "no meta",
  );

  const preset = DEMO_PRESETS[0];
  const order = (await post("/api/order", {
    restaurantId: "demo-trattoria",
    profile: { ...preset.profile, excludedIngredientIds: [] },
    text: preset.order,
    partySize: 1,
  })) as {
    result?: { items: { dishId: string }[]; removed: { dishId: string; reasons: unknown[]; alternatives: string[] }[] };
    meta?: { servedFrom: string } | null;
  };
  const removed = order.result?.removed ?? [];
  check("order removes a clashing dish, with a reason", removed.length > 0 && removed.every((line) => line.reasons.length > 0), removed.map((line) => line.dishId).join(", "));
  check("order keeps allowed dishes or offers alternatives", (order.result?.items.length ?? 0) + removed.flatMap((line) => line.alternatives).length > 0);
  check(`order served from ${expect}`, order.meta?.servedFrom === expect, order.meta?.servedFrom ?? "no meta");

  const metrics = (await (await get("/api/metrics")).json()) as { status: string; running: number | null };
  check(`vLLM metrics are ${healthExpected}`, metrics.status === healthExpected, `${metrics.status}, running ${metrics.running ?? "–"}`);

  console.log("\nCheck by hand in a browser:");
  console.log(`  - ${base}/demo: send the Japanese order from the phone; the Italian ticket appears on the right; "Confermato al tavolo" updates the phone.`);
  console.log(`  - ${base}/metrics: the badge is ${healthExpected} and the call log fills as you use the menu.`);
  console.log(failures.length ? `\n${failures.length} check(s) failed.` : "\nAll checks passed.");
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
