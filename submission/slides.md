# MenuBridge slides

Ten slides. Fill every double-bracket placeholder from `bench/results.md`, the AMD panel and the pilot before exporting to PDF; `npm run check-submission` lists them.

## 1. MenuBridge

Order in your language. The kitchen gets it in theirs.

[[QR code of the live URL]] · [[live URL]]

> Speaker notes: MenuBridge is a QR menu that rewrites itself for each diner and sends the kitchen a ticket in Italian. Everything you will see runs live on one AMD Instinct MI300X.

## 2. The problem

- Rome had 22.9 million tourist arrivals in 2025.
- The menu is in Italian; most visitors can't read it.
- Anyone with an allergy trusts a rushed translation or a busy waiter.
- Staff spend minutes per foreign table explaining dishes, and mistakes reach the kitchen.

> Speaker notes: This isn't a translation problem. A translated menu still doesn't tell a Japanese family what cacio e pepe is, and it can't promise anything about allergens.

## 3. One dish, two diners

[[Screenshot: carbonara for the Japanese first-timer]] · [[Screenshot: carbonara for the Italian food lover]]

The menu is written for the person holding it: a first-timer gets what it is and how to eat it; a food lover gets origin, technique and the detail Romans argue about.

> Speaker notes: Same dish, same ingredient sheet, two experiences. The model writes the words; nothing about safety changes between them.

## 4. How it works

[[Diagram from /about: diner → app → Gemma 4 on MI300X → allergen and diet check (fixed rules) → Italian kitchen ticket; the ingredient sheet feeds the check]]

> Speaker notes: The diner orders in their own words. Gemma maps that to dish IDs and translates notes; then deterministic code checks every dish against the owner-approved ingredient sheet before anything reaches the kitchen.

## 5. What the AI does, and never does

| Gemma 4 does | It never decides |
|---|---|
| Explains dishes in 8 languages for 4 audiences | Which allergens a dish contains |
| Maps "something Roman, no pork" to dish IDs | Whether a dish fits a diet |
| Translates notes into Italian for the kitchen | Whether a dish is safe |
| Drafts a new restaurant's ingredient sheet for the owner to approve | What reaches the kitchen |

> Speaker notes: Allergens come from fixed rules over the restaurant's own sheet. The model can only name dishes that exist, every answer is validated, and a claim guard rejects "gluten-free" or "safe for" in 8 languages.

## 6. Built on AMD

- Gemma 4 26B-A4B (mixture of experts, about 4B active parameters) on one AMD Instinct MI300X, 192 GB
- vLLM on ROCm, JSON-schema constrained output
- [[Benchmark table from bench/results.md: concurrency 1, 8, 32, 64 with tokens/s and p50/p95]]
- [[EUR per menu view and EUR per order at concurrency 32]]
- [[rocm-smi screenshot taken during a request]]

> Speaker notes: One GPU serves [[output tokens/s at concurrency 32]] tokens per second at realistic load. A full diner experience, a menu and an order, costs [[EUR per diner]] of GPU time.

## 7. Track compliance

- **Created:** a personal menu, an order, an Italian kitchen ticket
- **Model generates:** explanations, dish mapping, translated notes
- **Quality control:** fixed-rule gate, dish-ID enums, zod validation, claim guard, owner approval, waiter confirmation, AI labels
- **Cost per experience:** [[EUR per diner from the benchmark]]
- **Who pays:** the restaurant, monthly subscription

> Speaker notes: All of this is also on the About page of the live app, with live counters from the AMD panel.

## 8. Business and pilot

- The restaurant pays a monthly subscription; we will test €29 a month with the pilot.
- Measurable gain: staff minutes per foreign table, order mistakes, allergen questions answered without staff.
- [[Pilot restaurant's name and quote]] · [[Photo of the signed letter of intent]]

> Speaker notes: [[One sentence from the owner, for example how often staff explain dishes to foreign tables.]]

## 9. Roadmap

- Till (POS) integration, so tickets go straight to the kitchen printer
- Payments at the table
- More cities and cuisines, owner-run menu import
- IMMENT incubation: [[one line on what incubation would unlock]]

> Speaker notes: The menu import already works: paste a printed menu, the owner approves the draft, and the restaurant is live.

## 10. Thanks

[[Your name]] · [[live URL]] · github.com/feedddosever/amdgimmemyaccess · [[video link]]

> Speaker notes: Try it now: scan the QR code on the first slide and order something Roman.
