"use client";

import { useState } from "react";
import AmdStrip from "@/components/AmdStrip";
import KitchenBoard from "@/components/kitchen/KitchenBoard";

const PRESETS = [
  { label: "Japanese first-timer", params: "lang=ja&aud=first_timer" },
  { label: "German family with a child", params: "lang=de&aud=family" },
  { label: "English diner: fish allergy, no pork", params: "lang=en&aud=dietary&allergens=fish&diets=no_pork" },
  { label: "Italian food lover", params: "lang=it&aud=foodie" },
];

// One screen for the video: the diner's phone on the left, the kitchen on the right.
export default function DemoScreen() {
  const [preset, setPreset] = useState(0);
  const src = `/m/demo-trattoria?${PRESETS[preset].params}&table=7`;

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 lg:p-6" lang="en">
      <div className="grid flex-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <label className="flex w-full max-w-[400px] flex-col gap-1 text-sm font-medium">
            Diner
            <select
              value={preset}
              onChange={(event) => setPreset(Number(event.target.value))}
              className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
            >
              {PRESETS.map((option, index) => (
                <option key={option.label} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-[2.75rem] bg-ink p-3 shadow-xl">
            <iframe
              key={src}
              src={src}
              title="Diner phone"
              className="h-[760px] w-[375px] rounded-[2.1rem] bg-paper"
            />
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
