import { useEffect, useState } from "react";

// "system" follows prefers-color-scheme; "light"/"dark" pin it. Stored per browser.
const KEY = "home-cams:theme";
const NEXT = { system: "light", light: "dark", dark: "system" };

function load() {
  try {
    const v = localStorage.getItem(KEY);
    return v in NEXT ? v : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(load);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }, [theme]);

  return [theme, () => setTheme((t) => NEXT[t])];
}
