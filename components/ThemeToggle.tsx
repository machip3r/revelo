"use client";

import { useCallback, useEffect, useState } from "react";
import { applyStoredTheme, setStoredTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  const sync = useCallback(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    applyStoredTheme();
    sync();
  }, [sync]);

  function toggle() {
    const nextDark = !document.documentElement.classList.contains("dark");
    if (nextDark) {
      document.documentElement.classList.add("dark");
      setStoredTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setStoredTheme("light");
    }
    setDark(nextDark);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-lg transition hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
