"use client";

import { useState } from "react";
import AmdStrip from "@/components/AmdStrip";
import KitchenBoard from "@/components/kitchen/KitchenBoard";
import { DEMO_PRESETS, presetParams } from "@/lib/site";

// One screen for the video: the diner's phone on the left, the kitchen on the right.
export default function DemoScreen() {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const preset = DEMO_PRESETS[index];
  const src = `/m/demo-trattoria?${presetParams(preset)}&table=7`;

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(preset.order);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 lg:p-6" lang="en">
      <div className="grid flex-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-3 justify-self-center">
          <label className="flex w-full flex-col gap-1 text-sm font-medium">
            Diner
            <select
              value={index}
              onChange={(event) => {
                setIndex(Number(event.target.value));
                setCopied(false);
              }}
              className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
            >
              {DEMO_PRESETS.map((option, i) => (
                <option key={option.label} value={i}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex w-full items-start gap-2 rounded-lg bg-white p-2 text-sm ring-1 ring-line">
            <p className="flex-1">
              <span className="text-muted">Order to type: </span>
              <span lang={preset.profile.lang}>{preset.order}</span>
            </p>
            <button type="button" onClick={copyOrder} className="min-h-11 shrink-0 rounded-full px-3 font-medium ring-1 ring-line">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="rounded-[2.75rem] bg-ink p-3 shadow-xl">
            <iframe key={src} src={src} title="Diner phone" className="h-[760px] w-[375px] rounded-[2.1rem] bg-paper" />
          </div>
        </div>
        <div className="min-w-0 overflow-y-auto lg:max-h-[calc(100vh-7rem)]">
          <KitchenBoard compact />
        </div>
      </div>
      <AmdStrip />
    </div>
  );
}
