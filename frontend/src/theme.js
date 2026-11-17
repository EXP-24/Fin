// Theme ("light" | "dark" | "system") and visual-effects preference, persisted
// in localStorage. Components subscribe via the "finsight:prefs" window event.
const THEME_KEY = "theme";
const FX_KEY = "fx";

const read = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};

export const getTheme = () => read(THEME_KEY, "dark");
export const getEffects = () => read(FX_KEY, "on") !== "off";

export function resolveTheme(theme = getTheme()) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme === "light" ? "light" : "dark";
}

export function applyTheme(theme = getTheme()) {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

const notify = () => window.dispatchEvent(new Event("finsight:prefs"));

export function setTheme(theme) {
  write(THEME_KEY, theme);
  applyTheme(theme);
  notify();
}

export function setEffects(on) {
  write(FX_KEY, on ? "on" : "off");
  document.documentElement.classList.toggle("no-fx", !on);
  notify();
}

/** Call once at startup; keeps "system" in sync with the OS. */
export function initTheme() {
  applyTheme();
  document.documentElement.classList.toggle("no-fx", !getEffects());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getTheme() === "system") applyTheme();
  });
}
