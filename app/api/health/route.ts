import { connection } from "next/server";
import { config } from "@/lib/config";

export const maxDuration = 60;

type Health = { status: "live" | "offline" | "mock"; model: string };

export async function GET() {
  // Without this, Cache Components would prerender the status at build time.
  await connection();
  const cfg = config();
  if (cfg.mock) return Response.json({ status: "mock", model: cfg.model } satisfies Health);

  const offline = Response.json({ status: "offline", model: cfg.model } satisfies Health);
  if (!cfg.baseURL) return offline;
  try {
    const response = await fetch(`${cfg.baseURL}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return offline;
    const body = (await response.json()) as { data?: { id?: string }[] };
    // Live only if the endpoint actually serves the configured model.
    if (!body.data?.some((model) => model.id === cfg.model)) return offline;
    return Response.json({ status: "live", model: cfg.model } satisfies Health);
  } catch {
    return offline;
  }
}
