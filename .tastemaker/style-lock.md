# Polaris CRM — Style Lock

Established: cold start (no references, no python for generator scripts — palette
hand-authored in OKLCH-ish reasoning, contrast verified with node WCAG math).

## Classification
App-shell product (internal CRM). Screens: dashboard (data view), list/table
views, kanban boards, detail pages with sectioned forms, auth. NOT marketing.
→ App-shell motion track (panel/list stagger, transitions, skeletons). No
scroll-storytelling, no marketing hero, no Step 2.5 macrostructure rotation.

## Direction
Refined professional data tool (Linear / Vercel dashboard / Height lane).
MONOCHROME to match the Polaris Dev brand (black wordmark + chrome mark): neutral
black/white, no blue. Accent = near-black in light, near-white in dark (used for
primary actions, active nav, focus rings). Avoids AI-slop tells: no gradients,
no gradient text, no glow, no emoji nav icons. Restrained motion.

## Color contract (monochrome — updated per brand)
Light: bg #ffffff · surface #f7f7f8 · surface-2 #efeff1 · border #e4e4e7 ·
text #18181b · muted #52525b · primary #18181b · primary-hover #000000 ·
on-primary #ffffff · link #18181b
Dark:  bg #0a0a0b · surface #141416 · surface-2 #1c1c1f · border #29292e ·
text #f4f4f5 · muted #a1a1aa · primary #fafafa · primary-hover #e4e4e7 ·
on-primary #0a0a0b · link #fafafa
All text/UI pairings ≥ 7:1 (verified node WCAG). No blue anywhere.

Verified text-safe (≥4.5): text/bg, muted/bg, muted/surface, on-primary/primary,
link/bg — both modes. Borders are decorative separators (not state-bearing).
Semantic status colors (green/amber/blue/red/gray) retained for badges.

Runtime light/dark toggle: yes (data-theme on <html>, defaults to system).

## Type
Plus Jakarta Sans (UI + display, single family across weight scale, via
next/font). JetBrains Mono for figures — deal values, counts, dates, ids
(tabular numerals). Loaded self-hosted through next/font (no external request).

## Radius / shadow / spacing
Radius: sm 6px · md 8px · lg 12px · xl 16px · full 9999px.
Shadow: subtle only (sm/md), never heavy. Cards use 1px border + faint shadow.
Spacing: 4px base scale. Card internal padding ≥ 16px, ≤ gap to neighbors.
Section rhythm on pages: 32px between major sections.

## Identity
Real brand logo supplied by user: chrome 4-point star mark + "POLARIS DEV"
wordmark (black-on-white PNG at public/brand/polaris-lockup.png). Rendered via
`.brand-logo` blend (multiply in light, invert+screen in dark) so it sits
seamlessly on either theme with no logo box. Used in sidebar, mobile topbar,
login. SVG PolarisMark kept as fallback.

## Shell
Left sidebar (brand + icon nav + active state) on desktop, collapses to a top
bar on mobile. Topbar carries page context + user menu + theme toggle.

## Motion (app-shell track)
Subtle staggered fade/rise on list & card entrance (≤ 320ms, reduced-motion
aware). Nav/hover transitions ≤ 160ms. No layout-property animation. No
scroll-hijack. Respect prefers-reduced-motion.
