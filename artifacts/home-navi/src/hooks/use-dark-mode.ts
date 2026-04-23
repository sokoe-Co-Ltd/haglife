import { useState, useEffect, useCallback } from "react";

export type ColorMode = "light" | "dark" | "system";

const STORAGE_KEY = "home-navi-color-mode";
const VALID_MODES: ColorMode[] = ["light", "dark", "system"];

function readStoredMode(): ColorMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_MODES.includes(stored as ColorMode) ? (stored as ColorMode) : "system";
}

function applyMode(mode: ColorMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else if (mode === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

export function useDarkMode(): {
  isDark: boolean;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
} {
  const [mode, setModeState] = useState<ColorMode>(() => readStoredMode());

  const [isDark, setIsDark] = useState(() => {
    const effective = readStoredMode();
    if (effective === "dark") return true;
    if (effective === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    applyMode(mode);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyMode("system");
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((next: ColorMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return { isDark, mode, setMode };
}
