"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "./icons";

/** No-flash theme init: run before paint to set data-theme from storage/system. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('polaris-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

/** Light/dark toggle. Persists the choice; falls back to system on first visit. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("polaris-theme", next);
    } catch {
      /* ignore storage failures */
    }
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost !p-2"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title="Toggle theme"
    >
      {/* Render a stable icon until mounted to avoid hydration mismatch. */}
      {mounted && theme === "dark" ? (
        <IconSun className="h-[18px] w-[18px]" />
      ) : (
        <IconMoon className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
