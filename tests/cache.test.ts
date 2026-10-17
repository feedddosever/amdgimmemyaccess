import { describe, expect, it } from "vitest";
import { cacheKey } from "@/lib/cache";

describe("cacheKey", () => {
  const base = { task: "order", restaurantId: "demo-trattoria" };

  it("ignores the order of profile arrays and object keys", () => {
    const a = cacheKey({ ...base, profile: { lang: "en", diets: ["vegan", "no_pork"], allergens: ["fish", "milk"] }, input: { text: "x", n: 1 } });
    const b = cacheKey({ ...base, profile: { allergens: ["milk", "fish"], diets: ["no_pork", "vegan"], lang: "en" }, input: { n: 1, text: "x" } });
    expect(a).toBe(b);
  });

  it("changes with the task, restaurant, profile or input", () => {
    const key = cacheKey({ ...base, profile: { lang: "en" }, input: "x" });
    expect(cacheKey({ ...base, task: "personalize", profile: { lang: "en" }, input: "x" })).not.toBe(key);
    expect(cacheKey({ ...base, restaurantId: "other", profile: { lang: "en" }, input: "x" })).not.toBe(key);
    expect(cacheKey({ ...base, profile: { lang: "ja" }, input: "x" })).not.toBe(key);
    expect(cacheKey({ ...base, profile: { lang: "en" }, input: "y" })).not.toBe(key);
  });

  it("is safe to use as a file name", () => {
    expect(cacheKey({ ...base, input: "../../etc/passwd" })).toMatch(/^order--demo-trattoria--[0-9a-f]{16}$/);
  });
});
