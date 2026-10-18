import OpenAI, { BadRequestError, RateLimitError } from "openai";
import { z } from "zod";
import { readCache, writeCache } from "@/lib/cache";
import { config } from "@/lib/config";

export const GPU_NAME = "AMD Instinct MI300X";

export type ServedFrom = "live" | "cache" | "mock";

export type LLMMeta = {
  task: string;
  model: string;
  servedFrom: ServedFrom;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  tokensPerSec: number;
  costEur: number | null;
  gpu: typeof GPU_NAME;
  // Replies rejected by zod validation before the accepted one (0 or 1).
  validationRetries: number;
  // Personalize only: dish texts in this reply rejected by the claim guard.
  qualityRejections?: number;
};

export type LLMResult<T> = { data: T; meta: LLMMeta };

export class LLMError extends Error {
  constructor(
    message: string,
    readonly reason: "unreachable" | "invalid_output" | "no_mock",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "LLMError";
  }
}

export type GenerateArgs<T> = {
  task: string;
  system: string;
  user: string;
  // Use strict objects (z.strictObject) so unknown fields are rejected, not stripped.
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  cacheKey?: string;
  // Canned answer for MOCK_LLM=1, usually from lib/mocks.ts.
  mock?: () => T;
};

const REQUEST_TIMEOUT_MS = 45_000;
// Whole-call budget, below the API routes' maxDuration of 60 s, so a slow
// first reply plus a retry ends in the cache or a fallback rather than a 504.
const CALL_BUDGET_MS = 50_000;

type Mode = "response_format" | "structured_outputs" | "prompt";

// Shared endpoints such as AMD Token Factory cap parallel requests per key and answer
// 429 above the cap. With LLM_MAX_CONCURRENCY set, calls beyond it wait for a free
// slot; a 429 is retried after the server's Retry-After, inside the call budget.
const RATE_LIMIT_RETRIES = 3;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function acquireSlot(limit: number | null, deadline: number): Promise<boolean> {
  if (!limit) return true;
  while (inFlight >= limit) {
    if (deadline - Date.now() < 1_000) {
      // Hand the wake-up on, in case a slot freed while this call gave up.
      waiting.shift()?.();
      return false;
    }
    await new Promise<void>((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        resolve();
      };
      // Near the deadline, stop waiting and leave the queue, so no release is spent on this call.
      const timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(wake) >>> 0, 1);
        resolve();
      }, Math.max(0, deadline - Date.now() - 1_000));
      waiting.push(wake);
    });
  }
  inFlight++;
  return true;
}

function releaseSlot(limit: number | null) {
  if (!limit) return;
  inFlight--;
  waiting.shift()?.();
}

function retryAfterMs(error: InstanceType<typeof RateLimitError>, attempt: number): number {
  const header = error.headers instanceof Headers ? error.headers.get("retry-after") : null;
  const seconds = Number(header);
  return header && Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1_000, 10_000) : 1_000 * 2 ** attempt;
}
export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Usage = { promptTokens: number; completionTokens: number };

// Each call pays its share of a GPU running at the benchmarked throughput: the
// droplet costs GPU_HOURLY_USD per hour and serves BENCH_TOKENS_PER_SEC × 3600
// tokens per hour at realistic load, so one token costs
// GPU_HOURLY_USD / (BENCH_TOKENS_PER_SEC × 3600) dollars, and EUR_PER_USD turns
// that into euros. Prompt tokens are charged at the output rate although prefill
// is much faster, so this is an upper bound. Null until all three are set.
export function costEur(tokens: number): number | null {
  const { gpuHourlyUsd, eurPerUsd, benchTokensPerSec } = config();
  if (gpuHourlyUsd === null || eurPerUsd === null || benchTokensPerSec === null) return null;
  return (tokens * gpuHourlyUsd * eurPerUsd) / (benchTokensPerSec * 3600);
}

function buildMeta(task: string, model: string, servedFrom: ServedFrom, startedAt: number, usage: Usage, validationRetries: number): LLMMeta {
  const latencyMs = Date.now() - startedAt;
  const seconds = latencyMs / 1000;
  return {
    task,
    model,
    servedFrom,
    latencyMs,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    tokensPerSec: seconds > 0 ? usage.completionTokens / seconds : 0,
    costEur: servedFrom === "mock" ? 0 : costEur(usage.promptTokens + usage.completionTokens),
    gpu: GPU_NAME,
    validationRetries,
  };
}

// Finds the first complete JSON object in a reply, ignoring prose or code fences around it.
export function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to scanning
  }
  const start = trimmed.indexOf("{");
  if (start === -1) throw new SyntaxError("no JSON object in reply");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return JSON.parse(trimmed.slice(start, i + 1));
  }
  throw new SyntaxError("unterminated JSON object in reply");
}

export function validate<T>(text: string, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = extractJSON(text);
  } catch (error) {
    return { ok: false, error: `not valid JSON (${(error as Error).message})` };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: z.prettifyError(parsed.error) };
}

// Asks for schema-constrained output. A server that rejects response_format gets
// vLLM's structured_outputs instead, and failing that a plain "JSON only" prompt.
export async function complete(
  client: OpenAI,
  args: { model: string; messages: Message[]; jsonSchema: object; task: string; maxTokens?: number; temperature?: number },
  deadline: number,
): Promise<{ text: string; model: string; usage: Usage }> {
  const limit = config().maxConcurrency;
  for (const mode of ["response_format", "structured_outputs", "prompt"] as Mode[]) {
    const body: Record<string, unknown> = {
      model: args.model,
      messages: args.messages,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
    };
    if (mode === "response_format") {
      body.response_format = { type: "json_schema", json_schema: { name: args.task, schema: args.jsonSchema, strict: true } };
    } else if (mode === "structured_outputs") {
      body.structured_outputs = { json: args.jsonSchema };
    }
    for (let rateLimited = 0; ; rateLimited++) {
      if (deadline - Date.now() < 1_000 || !(await acquireSlot(limit, deadline))) {
        throw new LLMError("time budget exhausted", "unreachable");
      }
      let retryIn: number | null = null;
      try {
        const response = await client.chat.completions.create(
          body as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
          { timeout: Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()) },
        );
        return {
          text: response.choices[0]?.message?.content ?? "",
          model: response.model || args.model,
          usage: {
            promptTokens: response.usage?.prompt_tokens ?? 0,
            completionTokens: response.usage?.completion_tokens ?? 0,
          },
        };
      } catch (error) {
        if (error instanceof RateLimitError && rateLimited < RATE_LIMIT_RETRIES) {
          const wait = retryAfterMs(error, rateLimited);
          if (deadline - Date.now() > wait + 1_000) retryIn = wait;
        }
        if (retryIn === null && !(error instanceof BadRequestError && mode !== "prompt")) throw error;
      } finally {
        releaseSlot(limit);
      }
      // A 400 means this server does not take this structured output mode: try the next one.
      if (retryIn === null) break;
      await new Promise((resolve) => setTimeout(resolve, retryIn));
    }
  }
  throw new Error("no structured output mode left");
}

// The request the app sends for a task. The JSON Schema goes in the system prompt
// too, so the model sees field meanings in every structured-output mode.
export function prepareRequest(args: { system: string; user: string; schema: z.ZodType }): {
  jsonSchema: Record<string, unknown>;
  messages: Message[];
} {
  const jsonSchema = z.toJSONSchema(args.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return {
    jsonSchema,
    messages: [
      {
        role: "system",
        content: `${args.system}\n\nReply with one JSON object only, no other text, matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
      },
      { role: "user", content: args.user },
    ],
  };
}

export function createClient(): OpenAI {
  const cfg = config();
  return new OpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey || "not-set",
    maxRetries: 0,
    // Resolved per request so tests can replace the global fetch.
    fetch: (url, init) => globalThis.fetch(url, init),
  });
}

async function fromCache<T>(task: string, key: string | undefined, schema: z.ZodType<T>): Promise<LLMResult<T> | null> {
  if (!key) return null;
  const entry = (await readCache(key)) as { data?: unknown; meta?: LLMMeta } | null;
  const parsed = entry ? schema.safeParse(entry.data) : null;
  if (!entry?.meta || !parsed?.success) return null;
  return { data: parsed.data, meta: { ...entry.meta, task, servedFrom: "cache" } };
}

export async function generateJSON<T>(args: GenerateArgs<T>): Promise<LLMResult<T>> {
  const cfg = config();
  const startedAt = Date.now();

  if (cfg.mock) {
    if (!args.mock) throw new LLMError(`no mock for task "${args.task}"`, "no_mock");
    const data = args.schema.parse(args.mock());
    return { data, meta: buildMeta(args.task, cfg.model, "mock", startedAt, { promptTokens: 0, completionTokens: 0 }, 0) };
  }

  const { jsonSchema, messages: initialMessages } = prepareRequest(args);
  let messages = initialMessages;
  const client = createClient();
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const deadline = startedAt + CALL_BUDGET_MS;

  try {
    if (!cfg.baseURL) throw new LLMError("LLM_BASE_URL is not set", "unreachable");
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await complete(
        client,
        { model: cfg.model, messages, jsonSchema, task: args.task, maxTokens: args.maxTokens, temperature: args.temperature },
        deadline,
      );
      usage.promptTokens += reply.usage.promptTokens;
      usage.completionTokens += reply.usage.completionTokens;

      const result = validate(reply.text, args.schema);
      if (result.ok) {
        const meta = buildMeta(args.task, reply.model, "live", startedAt, usage, attempt);
        if (args.cacheKey) await writeCache(args.cacheKey, { data: result.data, meta });
        return { data: result.data, meta };
      }
      messages = [
        ...messages,
        { role: "assistant", content: reply.text },
        { role: "user", content: `Your reply was rejected:\n${result.error}\nReply again with only the corrected JSON object.` },
      ];
    }
    throw new LLMError(`model output failed validation twice for task "${args.task}"`, "invalid_output");
  } catch (error) {
    if (error instanceof LLMError && error.reason !== "unreachable") throw error;
    // Network error, timeout, an error status or an unreadable response from the
    // server: serve the saved output if there is one.
    const cached = await fromCache(args.task, args.cacheKey, args.schema);
    if (cached) return cached;
    throw new LLMError(`model unreachable and no cached output for task "${args.task}"`, "unreachable", { cause: error });
  }
}
