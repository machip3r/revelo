const STORAGE_KEY = "revelo-theme";

export function applyStoredTheme() {
  if (typeof document === "undefined") return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else if (stored === "dark") {
      document.documentElement.classList.add("dark");
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  } catch {
    document.documentElement.classList.add("dark");
  }
}

export function setStoredTheme(mode: "light" | "dark") {
  localStorage.setItem(STORAGE_KEY, mode);
}
