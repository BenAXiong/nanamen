"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nanamen-theme";

// Tiny external store over the <html> element's "dark" class, mirroring
// lib/state.ts's pattern -- useSyncExternalStore lets React (and the lint
// rule that flags setState-in-effect as a cascading-render risk) treat the
// DOM class as the external system, rather than mirroring it into local
// state via useEffect.

let cachedIsDark = true;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  // The blocking script in app/layout.tsx already set this class before
  // hydration, so this just reads the real, already-correct value.
  cachedIsDark = document.documentElement.classList.contains("dark");
  initialized = true;
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  ensureInitialized();
  return cachedIsDark;
}

function getServerSnapshot(): boolean {
  return true; // matches the blocking script's default: dark unless localStorage says otherwise
}

function commit(isDark: boolean) {
  cachedIsDark = isDark;
  document.documentElement.classList.toggle("dark", isDark);
  window.localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isDark, toggleTheme: () => commit(!isDark) };
}
