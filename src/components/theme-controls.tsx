"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { AccentColor } from "@/types";

const colors: { name: AccentColor; hex: string }[] = [
  { name: "blue", hex: "#2979ff" },
  { name: "green", hex: "#15b985" },
  { name: "purple", hex: "#a64ce6" },
  { name: "orange", hex: "#ff701c" },
];

export function ThemeControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentColor>("green");

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("wallet-accent") ||
      "green") as AccentColor;
    setAccent(saved);
    document.documentElement.dataset.accent = saved;
  }, []);

  function choose(c: AccentColor) {
    setAccent(c);
    localStorage.setItem("wallet-accent", c);
    document.documentElement.dataset.accent = c;
  }

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 md:static md:flex-row md:items-center md:gap-2">
      <div className="flex gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-2 shadow-sm">
        {colors.map((c) => (
          <button
            key={c.name}
            onClick={() => choose(c.name)}
            aria-label={`Cor ${c.name}`}
            className="h-4 w-4 rounded-full transition-transform hover:scale-110"
            style={{
              background: c.hex,
              outline: accent === c.name ? "2px solid var(--text2)" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
      <button
        aria-label="Alternar tema"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="btn-outline text-xs"
      >
        {resolvedTheme === "dark" ? "CLARO" : "ESCURO"}
      </button>
    </div>
  );
}
