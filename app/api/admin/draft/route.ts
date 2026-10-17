import { z } from "zod";
import { draftMenu, passcodeOk } from "@/lib/importMenu";
import { LLMError } from "@/lib/llm";

export const maxDuration = 60;

const Body = z.object({ passcode: z.string(), menuText: z.string().trim().min(10).max(20_000) });

// Drafts Menu JSON from the restaurant's Italian menu text, for the owner to check.
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Paste the menu text (10 to 20,000 characters)." }, { status: 400 });
  if (!passcodeOk(body.data.passcode)) return Response.json({ error: "Wrong passcode." }, { status: 401 });
  try {
    return Response.json(await draftMenu(body.data.menuText));
  } catch (error) {
    const message =
      error instanceof LLMError
        ? error.reason === "unreachable"
          ? "The model is unreachable. Start the GPU server, or try again."
          : "The model's draft did not pass validation twice. Try again, or shorten the menu."
        : "No dishes could be read from that text.";
    return Response.json({ error: message }, { status: 502 });
  }
}
