"use client";

import dynamic from "next/dynamic";

// Tickets come from localStorage and BroadcastChannel, so the board renders in the browser only.
const KitchenBoard = dynamic(() => import("@/components/kitchen/KitchenBoard"), { ssr: false });

export default function KitchenLoader() {
  return <KitchenBoard />;
}
