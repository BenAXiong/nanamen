"use client";

import { Volume2 } from "lucide-react";

export function AudioButton({
  url,
  playing,
  onPlay,
  size = "lg",
}: {
  url: string | null;
  playing?: boolean;
  onPlay: () => void;
  size?: "lg" | "sm";
}) {
  if (!url) return null;
  const dimensions = size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const icon = size === "lg" ? "h-7 w-7" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      aria-label="Play audio"
      className={`flex ${dimensions} shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-md transition active:scale-95 hover:bg-amber-600 ${
        playing ? "animate-pulse" : ""
      }`}
    >
      <Volume2 className={icon} />
    </button>
  );
}
