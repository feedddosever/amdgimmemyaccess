"use client";

import dynamic from "next/dynamic";

const DemoScreen = dynamic(() => import("@/components/demo/DemoScreen"), { ssr: false });

export default function DemoLoader() {
  return <DemoScreen />;
}
