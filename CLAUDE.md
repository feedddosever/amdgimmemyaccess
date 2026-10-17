# MenuBridge — project brief

## Product
MenuBridge is a QR menu web app for restaurants, built for the AMD Developer Hackathon ACT III (lablab.ai), track "Create a New Kind of Experience". Deadline: UNCONFIRMED — best guess Sunday 18 October 2026, 12:00 Europe/Rome (CEST, UTC+2); one official page says the build ends Saturday 17 October. Confirm on the lablab Discord ACT III channel and update this line. Solo builder: a working, deployed demo beats completeness.

Diner flow: scan QR -> choose language + audience (first time in Rome / food lover / family with kids / dietary needs) + allergens + diets -> the menu rewrites itself for this diner -> the diner types the order in their own words -> the app maps it to real dishes, blocks anything that clashes with their allergens or diet and explains why in their language -> diner confirms -> the kitchen gets a ticket in Italian -> a waiter confirms at the table.

## Rules that must never be broken
1. Allergen and diet facts NEVER come from the model. Deterministic code computes them from the menu JSON (the owner-approved ingredient sheet). The model only writes explanations, maps free text to dish IDs and translates notes.
2. The model can only reference dish and ingredient IDs that exist in the menu: JSON-schema enums in the request plus a server-side check that drops unknown IDs.
3. Every model output is validated with zod. On failure: retry once with the validation error, then fall back to a safe deterministic response. The UI never crashes on bad model output.
4. A dish with ownerApproved=false shows "Ask staff about allergens" and never passes the gate for a diner who declared any allergen or diet.
5. Every AI-written text in the UI carries a small "AI-generated" label.
6. No secrets in the repo. Read config from env: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_METRICS_URL, GPU_HOURLY_USD, EUR_PER_USD, BENCH_TOKENS_PER_SEC, ADMIN_PASSCODE, MOCK_LLM. Keep .env.example current. .env* is git-ignored.
7. MIT licence, public repo.
8. Every model call returns a `meta` object to the client: model, servedFrom (live | cache | mock), latencyMs, promptTokens, completionTokens, tokensPerSec, costEur, gpu ("AMD Instinct MI300X").
9. MOCK_LLM=1 runs the whole app with canned answers. If the live model is unreachable, serve saved outputs from data/cache and show the banner "GPU offline - showing results generated earlier on AMD Instinct MI300X".

## Stack
Next.js App Router, TypeScript strict, Tailwind, npm. `openai` npm package against an OpenAI-compatible endpoint (vLLM on AMD Instinct MI300X serving google/gemma-4-26B-A4B-it). zod, vitest. Deploy on Vercel; also ship a Dockerfile and docker-compose.yml. No database: menus are JSON in /data; orders live in the browser and move between tabs with BroadcastChannel.

Next.js 16 differs from older versions (Cache Components are on): follow @AGENTS.md and read the matching guide in node_modules/next/dist/docs/ before writing Next.js code.

## Conventions
- Typed modules in /lib; API routes in /app/api/*/route.ts with `export const maxDuration = 60`. No `runtime` export: Cache Components rejects it, and Node.js is already the default. A GET handler that must run per request calls `await connection()` (from next/server) first.
- UI strings in /lib/i18n.ts for it, en, de, fr, es, ja, zh, ru. Gate reasons come from i18n templates, never from the model.
- Diner UI mobile-first (max width 430 px); kitchen view desktop.
- Wrap every localStorage access in try/catch.
- After each task run `npm run lint`, `npm test` and `npm run build`; fix failures before saying done; then commit with a clear message.
