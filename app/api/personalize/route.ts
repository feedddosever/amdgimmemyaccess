import { z } from "zod";
import { getMenu } from "@/lib/menus";
import { personalizeMenu } from "@/lib/personalize";
import { DinerProfileSchema } from "@/lib/schema";

export const maxDuration = 60;

const Body = z.object({
  restaurantId: z.string(),
  profile: DinerProfileSchema.pick({ lang: true, audience: true }),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const menu = await getMenu(body.data.restaurantId);
  if (!menu) return Response.json({ error: "unknown restaurant" }, { status: 404 });
  return Response.json(await personalizeMenu(menu, body.data.profile));
}
