/**
 * Tag color palette. Tags are user categorization (not app chrome), so a small
 * set of hues is appropriate here — rendered as SOFT chips via color-mix so
 * they stay muted and adapt to light/dark automatically (tint of the surface,
 * text mixed toward the foreground). Keeps the monochrome shell intact while
 * letting tags be scannable.
 */
export const TAG_COLORS: Record<string, string> = {
  slate: "#64748b",
  blue: "#3b82f6",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  violet: "#7c3aed",
  teal: "#0d9488",
  pink: "#db2777",
};

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS);

export function tagChipStyle(color: string): React.CSSProperties {
  const hex = TAG_COLORS[color] ?? TAG_COLORS.slate;
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 15%, var(--bg))`,
    color: `color-mix(in srgb, ${hex} 68%, var(--text))`,
    borderColor: `color-mix(in srgb, ${hex} 30%, transparent)`,
  };
}
