"use client";

import dynamic from "next/dynamic";

// Client-only screens: they read localStorage, sessionStorage or BroadcastChannel, so they render in the browser only.
export const AmdDrawerLoader = dynamic(() => import("@/components/amd/AmdDrawer"), { ssr: false });
export const AmdPanelLoader = dynamic(() => import("@/components/amd/AmdPanel"), { ssr: false });
export const ImportLoader = dynamic(() => import("@/components/admin/ImportApp"), { ssr: false });
export const QualityCountersLoader = dynamic(() => import("@/components/QualityCounters"), { ssr: false });
