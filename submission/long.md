Rome had 22.9 million tourist arrivals in 2025. Most cannot read an Italian menu, and anyone with an allergy must trust a rushed translation.

MenuBridge is a QR menu that rewrites itself for the person holding it. A diner scans the code, picks one of 8 languages, says who they are (first time in Rome, food lover, family with kids, dietary needs) and declares any of the 14 EU allergens or a diet. Gemma 4 rewrites every dish for them, and they order in their own words, typed or spoken.

The AI never decides what is safe. Allergens and diets are computed by fixed rules from the restaurant's own ingredient sheet, approved by the owner dish by dish. A dish that clashes is removed with the reason in the diner's language, and safe alternatives are offered. The model can only name real dishes, every answer is validated, and a claim guard blocks words like "gluten-free". The kitchen receives a clean ticket in Italian, and a waiter confirms it at the table.

Gemma 4 26B-A4B runs on vLLM with ROCm on one AMD Instinct MI300X. A live AMD panel shows tokens per second, latency and the cost of every call: [[EUR per 1,000 orders at concurrency 32, from bench/results.md]] per 1,000 orders. Restaurants pay a monthly subscription; [[pilot status: the trattoria's name and quote, or "we are piloting with a trattoria in Rome"]].
