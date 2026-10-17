"use client";

import { useRef, useState } from "react";
import { LOCALES, t, type Lang } from "@/lib/i18n";

// The Web Speech API is not in TypeScript's DOM types yet; this is the part we use.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function MicButton({ lang, onText }: { lang: Lang; onText: (text: string) => void }) {
  const [Speech] = useState(recognitionConstructor);
  const [listening, setListening] = useState(false);
  const active = useRef<Recognition | null>(null);

  if (!Speech) return null;

  const toggle = () => {
    if (active.current) {
      active.current.stop();
      return;
    }
    const recognition = new Speech();
    recognition.lang = LOCALES[lang];
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ");
      if (transcript.trim()) onText(transcript.trim());
    };
    recognition.onend = recognition.onerror = () => {
      active.current = null;
      setListening(false);
    };
    active.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`min-h-11 rounded-full px-4 font-medium ring-1 focus-visible:outline-2 focus-visible:outline-terracotta ${
        listening ? "animate-pulse bg-terracotta text-white ring-terracotta" : "bg-white text-ink ring-line"
      }`}
    >
      🎤 {listening ? t(lang, "listening") : t(lang, "speak")}
    </button>
  );
}
