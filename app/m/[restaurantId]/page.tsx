import { notFound } from "next/navigation";
import DinerLoader from "@/components/diner/DinerLoader";
import { getMenu } from "@/lib/menus";

// Cache Components: params of a dynamic segment are runtime data unless
// generateStaticParams lists them, so the demo menu is prerendered here.
export function generateStaticParams() {
  return [{ restaurantId: "demo-trattoria" }];
}

export default async function DinerMenuPage({ params }: PageProps<"/m/[restaurantId]">) {
  const { restaurantId } = await params;
  const menu = await getMenu(restaurantId);
  if (!menu) notFound();
  return <DinerLoader menu={menu} />;
}
