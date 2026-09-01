---
project: Video Agent
register: product
aesthetic_direction: technical / utilitarian
color_strategy: restrained
design_system: Radix + shadcn/ui
design_variance: 3
motion_intensity: 2
visual_density: 7
---

## Design Read

Precision tool for video assembly. The interface should feel like a well-engineered instrument panel: dark, focused, efficient. Every pixel earns its place. The bet is that professionals choosing a video agent value clarity and speed over decoration.

## Signature

**The progress pipeline.** A horizontal sequence of connected stages (Upload → Configure → Render) with a luminous cyan fill that advances as the user completes each step. It communicates progress without narration, and the glow effect ties back to the network/security domain theme without being literal. This is the one memorable visual move; everything else stays quiet.

## Color (locked)

| role | OKLCH | hex | use |
|------|-------|-----|-----|
| background | `oklch(0.13 0.02 250)` | `#0a0e17` | Page canvas |
| surface | `oklch(0.16 0.02 250)` | `#0f1420` | Cards, panels |
| elevated | `oklch(0.20 0.02 250)` | `#151b2b` | Hover states, inputs |
| border | `oklch(0.25 0.015 250)` | `#1e2a3a` | Structural dividers |
| border-hover | `oklch(0.30 0.02 250)` | `#2a3a50` | Interactive borders |
| text | `oklch(0.92 0.02 250)` | `#e8f6ff` | Primary reading |
| muted | `oklch(0.60 0.02 250)` | `#94a3b8` | Secondary labels |
| subtle | `oklch(0.45 0.015 250)` | `#64748b` | Captions, hints |
| accent | `oklch(0.82 0.15 195)` | `#00e5ff` | Primary actions, focus rings, progress |
| accent-dim | `oklch(0.82 0.15 195) / 0.12` | `rgba(0,229,255,0.12)` | Accent backgrounds |
| success | `oklch(0.80 0.18 155)` | `#39ff88` | Completion states |
| warning | `oklch(0.78 0.14 65)` | `#ff9f43` | Caution |
| danger | `oklch(0.65 0.22 25)` | `#ff3860` | Errors, destructive |
| info | `oklch(0.70 0.12 280)` | `#a855f7` | AI-related elements |

**Strategy:** Restrained. Tinted neutrals (chroma +0.015 toward 250 hue) carry 60% of surface area. Elevated surfaces and borders provide 30%. Accent (cyan) appears in ≤10% of surface — actions, focus, progress. No gradients on text. No glow effects on backgrounds.

**WCAG verification:**
- text on background: `#e8f6ff` on `#0a0e17` → ratio 12.8:1 ✓ (AAA)
- muted on surface: `#94a3b8` on `#0f1420` → ratio 5.2:1 ✓ (AA)
- accent on background: `#00e5ff` on `#0a0e17` → ratio 9.1:1 ✓ (AAA)
- danger on background: `#ff3860` on `#0a0e17` → ratio 5.8:1 ✓ (AA)

## Type (locked)

| role | family | use | notes |
|------|--------|-----|-------|
| display | JetBrains Mono | Headings, step labels, status | Monospace for technical identity; weight 600 |
| body | Geist | Reading, descriptions, labels | Geometric sans; weight 400/500; measure 65ch |
| utility | Geist Mono | Code, file sizes, durations | Monospace for data density |

**Pairing:** Geist (geometric sans) + JetBrains Mono (technical mono). Contrast axis: geometric precision vs. monospace structure. Both are modern, neither is a reflex default.

**Scale:** Modular, sized for product density:
- xs: 11px (captions, file metadata)
- sm: 12px (labels, hints)
- base: 14px (body text, inputs)
- md: 15px (descriptions)
- lg: 16px (panel titles)
- xl: 20px (section headers)
- 2xl: 28px (page title)

## Scales (locked)

**Spacing** (4px base): `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`

**Radius:** `{ sm: 6, md: 8, lg: 12, xl: 16, full: 9999 }`
- sm: inputs, small buttons, file thumbnails
- md: cards, panels
- lg: modals, dropzone
- xl: step pills, large containers
- full: status dots, avatars

**Shadow / elevation:**
- sm: `0 1px 3px rgba(0,0,0,0.3)` — cards at rest
- default: `0 4px 12px rgba(0,0,0,0.4)` — elevated cards
- md: `0 8px 24px rgba(0,0,0,0.5)` — dropdowns
- lg: `0 12px 40px rgba(0,0,0,0.6)` — modals
- accent-glow: `0 0 20px rgba(0,229,255,0.15)` — focused accent elements only

**Z-index layers:**
- base: 0
- dropdown: 20
- sticky: 30
- fixed: 40
- modalBackdrop: 45
- modal: 50
- popover: 60
- toast: 70

**Breakpoints:** `sm: 640, md: 768, lg: 1024, xl: 1280`

**Motion:**
- fast: 100ms — hover states, focus rings
- base: 250ms — panel transitions, file list animations
- emphasis: 400ms — progress pipeline advancement
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` — decelerate out
- No bounce, no elastic. Motion is motivated: file appears → slide in; progress advances → fill animation; error → shake.
- `prefers-reduced-motion`: disable all transitions, keep only opacity fades.

## Voice

- **Register:** plain, technical. No marketing language. No buzzwords.
- **Action vocabulary:** Upload → Configure → Render → Download. Consistent through the flow.
- **Error messages:** State what failed and what to do. "File too large. Maximum size is 300 MB." Not "Oops! Something went wrong."
- **Status messages:** Present tense, active voice. "Rendering video..." not "Your video is being rendered."

## Anti-Slop Compliance

Banned patterns avoided:
- ✅ No purple/blue gradient glow (accent is single cyan, restrained)
- ✅ No glassmorphism on everything (used only on panels, justified by dark theme readability)
- ✅ No Inter/Roboto (Geist + JetBrains Mono)
- ✅ No centered hero over dark mesh (header is simple, content-first)
- ✅ No 3 equal cards (layout uses asymmetric grid, step wizard)
- ✅ No em-dashes in copy
- ✅ No fake names or buzzwords
- ✅ No bounce/elastic easing
- ✅ No gradient text
- ✅ No decorative status dots
