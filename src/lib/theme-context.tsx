import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/**
 * Theme is a first-class token switch, not a bolt-on inverter: `light` and
 * `dark` each have their own hand-tuned palette in src/styles.css. `system`
 * follows the device so a night-shift phone flips without anyone touching
 * a setting.
 *
 * The resolved class is applied to <html> by an inline script in __root.tsx
 * BEFORE hydration, so there is no white flash on a dark-theme device.
 */
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "rfl-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePreference): "light" | "dark" {
  const resolved = pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  if (Capacitor.isNativePlatform()) {
    void StatusBar.setOverlaysWebView({ overlay: true });
    void StatusBar.setBackgroundColor({ color: resolved === "dark" ? "#171C26" : "#FFFFFF" });
    void StatusBar.setStyle({ style: resolved === "dark" ? Style.Dark : Style.Light });
  }
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Read storage after mount only — a useState initializer that touches
  // localStorage hydration-mismatches (tanstack-execution-model).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const initial: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
    setPreferenceState(initial);
    setResolved(applyTheme(initial));
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    setResolved(applyTheme(value));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Inlined in <head> so the class lands before first paint. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'light';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
