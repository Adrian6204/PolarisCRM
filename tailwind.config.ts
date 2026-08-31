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
    },
  },
  plugins: [],
};

export default config;
