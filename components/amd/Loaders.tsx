"use client";

import dynamic from "next/dynamic";

// Both read the browser's session log and BroadcastChannel, so they render in the browser only.
export const AmdDrawerLoader = dynamic(() => import("@/components/amd/AmdDrawer"), { ssr: false });
export const AmdPanelLoader = dynamic(() => import("@/components/amd/AmdPanel"), { ssr: false });
