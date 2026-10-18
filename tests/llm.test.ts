import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { cacheKey, readCache, writeCache } from "@/lib/cache";
import { LLMError, extractJSON, generateJSON } from "@/lib/llm";

const schema = z.strictObject({ dishes: z.array(z.strictObject({ dishId: z.enum(["carbonara", "gricia"]), explanation: z.string() })) });
const valid = { dishes: [{ dishId: "carbonara", explanation: "Rome's most famous pasta." }] };
const key = cacheKey({ task: "personalize", restaurantId: "demo-trattoria", profile: { lang: "ja", audience: "first_timer" }, input: "primi" });

let cacheDir: string;
let fetchMock: ReturnType<typeof vi.fn>;

function completion(content: string, usage = { prompt_tokens: 100, completion_tokens: 50 }): Response {
  return new Response(
    JSON.stringify({
      id: "cmpl-1",
      object: "chat.completion",
      created: 0,
      model: "google/gemma-4-26B-A4B-it",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function badRequest(): Response {
  return new Response(JSON.stringify({ error: { message: "unsupported parameter" } }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

function requestBody(call: number): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

function generate() {
  return generateJSON({ task: "personalize", system: "Describe dishes.", user: "primi", schema, cacheKey: key });
}

beforeEach(() => {
  cacheDir = mkdtempSync(path.join(tmpdir(), "menubridge-cache-"));
  vi.stubEnv("MOCK_LLM", "0");
  vi.stubEnv("LLM_BASE_URL", "http://gpu.test:8000/v1");
  vi.stubEnv("LLM_API_KEY", "test-key");
  vi.stubEnv("LLM_MODEL", "google/gemma-4-26B-A4B-it");
  vi.stubEnv("GPU_HOURLY_USD", "2");
  vi.stubEnv("EUR_PER_USD", "0.9");
  vi.stubEnv("BENCH_TOKENS_PER_SEC", "1000");
  vi.stubEnv("CACHE_DIR", cacheDir);
  vi.stubEnv("CACHE_WRITE", "0");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(cacheDir, { recursive: true, force: true });
});

describe("generateJSON against the live endpoint", () => {
  it("returns validated data with meta", async () => {
    fetchMock.mockResolvedValueOnce(completion(JSON.stringify(valid)));
    const { data, meta } = await generate();

    expect(data).toEqual(valid);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://gpu.test:8000/v1/chat/completions");
    expect(meta).toMatchObject({
      task: "personalize",
      model: "google/gemma-4-26B-A4B-it",
      servedFrom: "live",
      promptTokens: 100,
      completionTokens: 50,
      gpu: "AMD Instinct MI300X",
      validationRetries: 0,
    });
    // 150 tokens × $2/h × 0.9 €/$ ÷ (1000 tokens/s × 3600 s)
    expect(meta.costEur).toBeCloseTo(7.5e-5, 10);
  });

  it("asks for JSON-schema constrained output", async () => {
    fetchMock.mockResolvedValueOnce(completion(JSON.stringify(valid)));
    await generate();
    const body = requestBody(0);
    expect(body.model).toBe("google/gemma-4-26B-A4B-it");
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "personalize", strict: true } });
    const jsonSchema = (body.response_format as { json_schema: { schema: Record<string, unknown> } }).json_schema.schema;
    expect(jsonSchema.additionalProperties).toBe(false);
    expect(jsonSchema.$schema).toBeUndefined();
  });

  it("retries once after invalid JSON and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(completion("Sure! Here is the menu"))
      .mockResolvedValueOnce(completion(JSON.stringify(valid), { prompt_tokens: 200, completion_tokens: 60 }));
    const { data, meta } = await generate();

    expect(data).toEqual(valid);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(meta.validationRetries).toBe(1);
    expect(meta.promptTokens).toBe(300);
    expect(meta.completionTokens).toBe(110);
    const retryMessages = requestBody(1).messages as { role: string; content: string }[];
    expect(retryMessages.at(-2)).toEqual({ role: "assistant", content: "Sure! Here is the menu" });
    expect(retryMessages.at(-1)?.content).toContain("Your reply was rejected");
  });

  it("makes exactly one retry when the JSON stays invalid, then throws LLMError", async () => {
    fetchMock.mockImplementation(async () => completion("{not json"));
    await expect(generate()).rejects.toMatchObject({ name: "LLMError", reason: "invalid_output" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown fields", async () => {
    const withExtra = { dishes: [{ ...valid.dishes[0], glutenFree: true }] };
    fetchMock.mockImplementation(async () => completion(JSON.stringify(withExtra)));
    await expect(generate()).rejects.toBeInstanceOf(LLMError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryMessages = requestBody(1).messages as { content: string }[];
    expect(retryMessages.at(-1)?.content).toContain('Unrecognized key: "glutenFree"');
  });

  it("rejects dish ids that are not on the menu", async () => {
    fetchMock.mockImplementation(async () => completion(JSON.stringify({ dishes: [{ dishId: "pizza", explanation: "x" }] })));
    await expect(generate()).rejects.toMatchObject({ reason: "invalid_output" });
  });

  it("falls back to structured_outputs, then to a JSON-only prompt, when the server rejects response_format", async () => {
    fetchMock
      .mockResolvedValueOnce(badRequest())
      .mockResolvedValueOnce(badRequest())
      .mockResolvedValueOnce(completion(`Here you go:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``));
    const { data } = await generate();

    expect(data).toEqual(valid);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestBody(0).response_format).toBeDefined();
    expect(requestBody(1).response_format).toBeUndefined();
    expect(requestBody(1).structured_outputs).toMatchObject({ json: { type: "object" } });
    expect(requestBody(2).response_format).toBeUndefined();
    expect(requestBody(2).structured_outputs).toBeUndefined();
    const system = (requestBody(2).messages as { content: string }[])[0].content;
    expect(system).toContain("Reply with one JSON object only");
  });
});

describe("generateJSON when the model is unreachable", () => {
  it("falls back to the cache on a network failure", async () => {
    vi.stubEnv("CACHE_WRITE", "1");
    fetchMock.mockResolvedValueOnce(completion(JSON.stringify(valid)));
    await generate();
    vi.stubEnv("CACHE_WRITE", "0");

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { data, meta } = await generate();
    expect(data).toEqual(valid);
    expect(meta.servedFrom).toBe("cache");
    expect(meta.gpu).toBe("AMD Instinct MI300X");
  });

  it("falls back to the cache when the server errors", async () => {
    vi.stubEnv("CACHE_WRITE", "1");
    await writeCache(key, { data: valid, meta: { task: "personalize", servedFrom: "live" } });
    fetchMock.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));
    expect((await generate()).meta.servedFrom).toBe("cache");
  });

  it("throws LLMError when there is no cache entry", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(generate()).rejects.toMatchObject({ name: "LLMError", reason: "unreachable" });
  });

  it("ignores a cache entry that no longer matches the schema", async () => {
    vi.stubEnv("CACHE_WRITE", "1");
    await writeCache(key, { data: { dishes: "stale" }, meta: { servedFrom: "live" } });
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(generate()).rejects.toBeInstanceOf(LLMError);
  });

  it("does not write the cache unless CACHE_WRITE=1", async () => {
    fetchMock.mockResolvedValueOnce(completion(JSON.stringify(valid)));
    await generate();
    expect(await readCache(key)).toBeNull();
  });
});

describe("generateJSON with MOCK_LLM=1", () => {
  it("returns the mock without calling the model", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    const { data, meta } = await generateJSON({ task: "personalize", system: "", user: "", schema, mock: () => valid });
    expect(data).toEqual(valid);
    expect(meta).toMatchObject({ servedFrom: "mock", costEur: 0, gpu: "AMD Instinct MI300X" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws LLMError when the task has no mock", async () => {
    vi.stubEnv("MOCK_LLM", "1");
    await expect(generateJSON({ task: "order", system: "", user: "", schema })).rejects.toMatchObject({ reason: "no_mock" });
  });
});

describe("extractJSON", () => {
  it("finds the first object in prose or a code fence", () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
    expect(extractJSON('Answer: ```json\n{"a":"}{"}\n``` done {"b":2}')).toEqual({ a: "}{" });
  });

  it("throws when there is no complete object", () => {
    expect(() => extractJSON("no json here")).toThrow(SyntaxError);
    expect(() => extractJSON('{"a": 1')).toThrow(SyntaxError);
  });
});

describe("generateJSON on a shared endpoint with per-key limits", () => {
  function rateLimited(retryAfter = "0"): Response {
    return new Response(JSON.stringify({ error: { message: "rate limit exceeded" } }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": retryAfter },
    });
  }

  it("retries a 429 after the server's Retry-After, in the same output mode", async () => {
    fetchMock.mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(completion(JSON.stringify(valid)));
    const { data, meta } = await generate();

    expect(data).toEqual(valid);
    expect(meta.servedFrom).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(1).response_format).toBeDefined();
  });

  it("falls back to the cache when the endpoint keeps answering 429", async () => {
    vi.stubEnv("CACHE_WRITE", "1");
    await writeCache(key, {
      data: valid,
      meta: { task: "personalize", model: "m", servedFrom: "live", latencyMs: 1, promptTokens: 1, completionTokens: 1, tokensPerSec: 1, costEur: 0, gpu: "AMD Instinct MI300X", validationRetries: 0 },
    });
    vi.stubEnv("CACHE_WRITE", "0");
    fetchMock.mockImplementation(async () => rateLimited());
    const { meta } = await generate();

    expect(meta.servedFrom).toBe("cache");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps at most LLM_MAX_CONCURRENCY requests in flight", async () => {
    vi.stubEnv("LLM_MAX_CONCURRENCY", "1");
    let running = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running--;
      return completion(JSON.stringify(valid));
    });
    const results = await Promise.all([generate(), generate(), generate()]);

    expect(results.every((result) => result.meta.servedFrom === "live")).toBe(true);
    expect(peak).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
