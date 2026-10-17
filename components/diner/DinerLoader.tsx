"use client";

import dynamic from "next/dynamic";
import type { Menu } from "@/lib/schema";

// The diner app lives on localStorage, BroadcastChannel and speech input, so it renders in the browser only.
const DinerApp = dynamic(() => import("@/components/diner/DinerApp"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-muted">…</p>,
});

export default function DinerLoader({ menu }: { menu: Menu }) {
  return <DinerApp menu={menu} />;
}
