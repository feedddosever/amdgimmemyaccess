import { passcodeOk } from "@/lib/importMenu";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSCODE) return Response.json({ ok: false, error: "ADMIN_PASSCODE is not set on the server." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;
  return passcodeOk(body?.passcode) ? Response.json({ ok: true }) : Response.json({ ok: false, error: "Wrong passcode." }, { status: 401 });
}
