"use client";

import dynamic from "next/dynamic";

// The meal record lives in localStorage, so the page renders in the browser only.
const MealsApp = dynamic(() => import("@/components/diner/MealsApp"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-muted">…</p>,
});

export default function MealsLoader({ restaurantId }: { restaurantId: string }) {
  return <MealsApp restaurantId={restaurantId} />;
}
