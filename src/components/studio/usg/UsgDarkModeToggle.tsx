"use client";
/**
 * UsgDarkModeToggle — dark mode for long reporting sessions.
 *
 * Feature 7: A dark theme (slate-900 background, amber text) with automatic
 * switch at sunset. Print stays white-on-black as always (the print engine
 * doesn't use Tailwind classes).
 *
 * Toggles a `dark` class on <html>. Persists to localStorage.
 * When set to "auto", switches based on local sunset time (18:00–06:00).
 */
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "auto";

const STORAGE_KEY = "usg-dark-mode";

export function UsgDarkModeToggle() {
  const [mode, setMode] = useState<Mode>("light");

  // Load saved mode
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
    if (saved) setMode(saved);
  }, []);

  // Apply dark mode
  useEffect(() => {
    const isDark = mode === "dark" || (mode === "auto" && isNightTime());
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const cycle = () => {
    setMode((prev) => (prev === "light" ? "dark" : prev === "dark" ? "auto" : "light"));
  };

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label = mode === "light" ? "Light" : mode === "dark" ? "Dark" : "Auto";

  return (
    <button
      onClick={cycle}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
        "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
      )}
      title={`Theme: ${label} (click to switch)`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}
