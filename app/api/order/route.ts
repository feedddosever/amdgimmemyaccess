import { z } from "zod";
import { getMenu } from "@/lib/menus";
import { takeOrder } from "@/lib/order";
import { DinerProfileSchema } from "@/lib/schema";

export const maxDuration = 60;

const Body = z.object({
  restaurantId: z.string(),
  profile: DinerProfileSchema,
  text: z.string().trim().min(1).max(1000),
  partySize: z.int().min(1).max(20).default(1),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const menu = await getMenu(body.data.restaurantId);
  if (!menu) return Response.json({ error: "unknown restaurant" }, { status: 404 });
  const { profile, text, partySize } = body.data;
  return Response.json(await takeOrder(menu, profile, text, partySize));
}
