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
Deep-ink neutrals + ONE confident flat "north-star" cobalt accent, used
sparingly (primary actions, active nav, focus rings). Deliberately avoids the
AI-slop tells: no indigo→purple gradient, no gradient text, no glow, no emoji
nav icons. Medium density, generous section rhythm, restrained motion.

## Color contract
Light: bg #ffffff · surface #f8fafc · surface-2 #f1f5f9 · border #e2e8f0 ·
text #0f172a · muted #5b6472 · primary #3b5bf5 · primary-hover #2f49d0 ·
on-primary #ffffff · link #2f49d0
Dark:  bg #0a0e17 · surface #111726 · surface-2 #161d2f · border #263041 ·
text #e7eaf0 · muted #98a1b4 · primary #6d86ff · primary-hover #5b74e8 ·
on-primary #0a0e17 · link #8ea3ff

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
Polaris star mark: geometric 4-point sparkle built from SVG primitives in the
accent color (cold-start constructed mark, not a letter-in-a-box). Inline SVG.

## Shell
Left sidebar (brand + icon nav + active state) on desktop, collapses to a top
bar on mobile. Topbar carries page context + user menu + theme toggle.

## Motion (app-shell track)
Subtle staggered fade/rise on list & card entrance (≤ 320ms, reduced-motion
aware). Nav/hover transitions ≤ 160ms. No layout-property animation. No
scroll-hijack. Respect prefers-reduced-motion.
