import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Theme is driven by [data-theme] on <html> (set no-flash by an inline script),
  // so `dark:` utilities and the CSS-var tokens stay in lockstep.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        fg: "var(--text)",
        muted: "var(--muted)",
        link: "var(--link)",
        brand: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          fg: "var(--on-primary)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      maxWidth: {
        content: "72rem",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "zoom-in": { from: { transform: "scale(0.97)" }, to: { transform: "scale(1)" } },
        "zoom-out": { from: { transform: "scale(1)" }, to: { transform: "scale(0.97)" } },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
        "fade-out": "fade-out 120ms ease-in",
        "pop-in": "fade-in 120ms ease-out, zoom-in 120ms ease-out",
        "pop-out": "fade-out 100ms ease-in, zoom-out 100ms ease-in",
      },
    },
  },
  plugins: [],
};

export default config;
