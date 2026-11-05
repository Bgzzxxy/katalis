import { useCallback, useEffect, useState } from "react";

/**
 * Theme preference for the Warm Editorial ↔ Obsidian Carbon switch (v4.0 §3.1).
 * Persisted in localStorage (fallback: prefers-color-scheme) and applied via
 * the `.dark` class on <html>, so every `var(--*)` token resolves per-theme.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "katalis-theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}