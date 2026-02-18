"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

export type AccentColor = "emerald" | "blue" | "violet" | "rose" | "amber" | "cyan" | "orange" | "pink";

export const ACCENT_COLORS: { id: AccentColor; label: string; hex: string; hoverHex: string }[] = [
  { id: "emerald", label: "Emerald", hex: "#10b981", hoverHex: "#059669" },
  { id: "blue",    label: "Blue",    hex: "#3b82f6", hoverHex: "#2563eb" },
  { id: "violet",  label: "Violet",  hex: "#8b5cf6", hoverHex: "#7c3aed" },
  { id: "rose",    label: "Rose",    hex: "#f43f5e", hoverHex: "#e11d48" },
  { id: "amber",   label: "Amber",   hex: "#f59e0b", hoverHex: "#d97706" },
  { id: "cyan",    label: "Cyan",    hex: "#06b6d4", hoverHex: "#0891b2" },
  { id: "orange",  label: "Orange",  hex: "#f97316", hoverHex: "#ea580c" },
  { id: "pink",    label: "Pink",    hex: "#ec4899", hoverHex: "#db2777" },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  accentHex: string;
  accentHoverHex: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getAccentDef(id: AccentColor) {
  return ACCENT_COLORS.find(c => c.id === id) || ACCENT_COLORS[0];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const [accentColor, setAccentColorState] = useState<AccentColor>("emerald");

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem("mission-control-theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
    }
    const storedAccent = localStorage.getItem("mission-control-accent") as AccentColor | null;
    if (storedAccent && ACCENT_COLORS.some(c => c.id === storedAccent)) {
      setAccentColorState(storedAccent);
    }
  }, []);

  useEffect(() => {
    // Resolve system theme
    const resolve = () => {
      if (theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return theme;
    };

    const resolved = resolve();
    setResolvedTheme(resolved);

    // Apply to document
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolved);

    // Listen for system changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => setResolvedTheme(resolve());
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  // Apply accent color CSS custom properties
  useEffect(() => {
    const accent = getAccentDef(accentColor);
    const root = document.documentElement;
    root.style.setProperty("--accent-color", accent.hex);
    root.style.setProperty("--accent-hover", accent.hoverHex);
    // Also set a data attribute for Tailwind-style selectors
    root.dataset.accent = accentColor;
  }, [accentColor]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("mission-control-theme", newTheme);
  };

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    localStorage.setItem("mission-control-accent", color);
  };

  const accentDef = getAccentDef(accentColor);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      resolvedTheme,
      accentColor,
      setAccentColor,
      accentHex: accentDef.hex,
      accentHoverHex: accentDef.hoverHex,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
