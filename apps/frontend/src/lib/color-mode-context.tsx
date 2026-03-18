/**
 * ColorModeContext — system-aware dark/light mode with manual override.
 *
 * Priority:
 *   1. User's manual choice stored in localStorage ("light" | "dark")
 *   2. OS/browser prefers-color-scheme media query
 *
 * The context exposes the resolved mode and a toggle function.
 * Toggling persists the new preference to localStorage and overrides the
 * system default for the rest of the session.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type ColorMode = "light" | "dark";

const STORAGE_KEY = "cv-tool:color-mode";

function getSystemMode(): ColorMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredMode(): ColorMode | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

type ColorModeContextValue = {
  mode: ColorMode;
  toggleColorMode: () => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(() => getStoredMode() ?? getSystemMode());

  // Keep in sync if the OS preference changes while no manual override is set.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!getStoredMode()) {
        setMode(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleColorMode = () => {
    setMode((prev) => {
      const next: ColorMode = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const value = useMemo(() => ({ mode, toggleColorMode }), [mode]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error("useColorMode must be used inside <ColorModeProvider>");
  return ctx;
}
