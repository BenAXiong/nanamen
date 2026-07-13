"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

// The three hidden, URL-only tools (see app/dialogue/page.tsx's comment) --
// no nav link anywhere, reachable only by knowing the path or finding this
// menu.
const LINKS = [
  { href: "/import", label: "Import" },
  { href: "/edit", label: "Edit" },
  { href: "/dialogue", label: "Dialogue" },
];

export function SecretMenuOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-lg dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-50">Hidden tools</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-center text-sm font-medium text-stone-700 transition active:scale-95 dark:border-stone-700 dark:text-stone-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
