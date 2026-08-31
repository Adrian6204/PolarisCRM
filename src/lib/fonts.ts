import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

/**
 * Type system (self-hosted via next/font — no external request, no layout
 * shift). Plus Jakarta Sans carries UI + display across a weight scale;
 * JetBrains Mono is reserved for figures (values, counts, dates, ids) with
 * tabular numerals.
 */
export const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});
