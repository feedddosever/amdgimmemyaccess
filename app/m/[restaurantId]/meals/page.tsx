import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MealsLoader from "@/components/diner/MealsLoader";
import { getMenu } from "@/lib/menus";

export const metadata: Metadata = { title: "My meals – MenuBridge" };

// Same as the menu page: the demo restaurant is prerendered for Cache Components.
export function generateStaticParams() {
  return [{ restaurantId: "demo-trattoria" }];
}

export default async function MealsPage({ params }: PageProps<"/m/[restaurantId]/meals">) {
  const { restaurantId } = await params;
  if (!(await getMenu(restaurantId))) notFound();
  return <MealsLoader restaurantId={restaurantId} />;
}
