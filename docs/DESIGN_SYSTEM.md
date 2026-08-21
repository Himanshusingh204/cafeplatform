# DESIGN_SYSTEM.md — Visual Language

## Direction

Premium, minimal, warm, elegant, editorial, Indian-inspired, photographic. No excessive gradients,
no glowing cards, no generic AI landing-page patterns, no meaningless statistics.

## Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#FAF8F5` | Warm white page background |
| `--foreground` | `#1F1D1A` | Deep charcoal text |
| `--card` | `#FFFFFF` | Card surfaces |
| `--muted` | `#F2EFEA` | Muted surfaces / wells |
| `--muted-foreground` | `#6B645C` | Secondary text |
| `--border` | `#E8E3DC` | Hairline borders |
| `--primary` | `#B5452A` | Muted earthy terracotta accent |
| `--primary-foreground` | `#FFFFFF` | Text on accent |
| `--secondary` | `#E7DDD0` | Soft cream |
| `--destructive` | `#B3261E` | Errors / destructive actions |
| `--ring` | `#B5452A` | Focus ring |

## Typography

- **Display:** Fraunces (editorial serif) — hero/section headings.
- **Body:** Inter or system sans — body, UI, forms.
- Scale (responsive, not fixed giant):
  - Hero: clamp(2.5rem, 6vw, 4.5rem)
  - Section heading: clamp(1.75rem, 3.5vw, 2.75rem)
  - Body: 1rem–1.125rem
  - Small: 0.8125rem–0.875rem

## Spacing

Use a scale: 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 2.5 / 3 / 4 / 6 / 8 rem.
Section spacing: `py-16 md:py-24`.

## Radius & Shadow

- Radius: `sm` 0.375rem · `md` 0.5rem · `lg` 0.75rem · `xl` 1rem · `full` (pills)
- Shadow: minimal — `shadow-sm` on cards, focus ring for interactive elements. No big glows.

## Buttons

- **Primary:** solid `--primary`, white text, rounded-full, py-2.5 px-6, hover darkens.
- **Secondary:** outline with `--border`, charcoal text.
- **Ghost:** transparent, hover muted.
- **Destructive:** `--destructive` surface.
- All buttons: `min-h-[44px]` tap target, visible focus ring, disabled state.

## Inputs

Label above, input below. Background white, border `--border`, radius `md`, `h-11`.
Focus: `ring-2 ring-ring/40` + border primary. Error: red border + message below.

## Cards

White, `border`, radius `lg`, `shadow-sm`, p-6. Hover: subtle translate-y + shadow.

## Badges

Small pills: `Vegetarian` (green tint), `Spicy` (red tint), `Popular` (primary tint), `Vegan`, `Contains Nuts`, `Sold Out` (muted).

## Navigation

- Desktop: centered logo, links left/right, CTA button.
- Mobile: hamburger → full drawer, large tap targets.
- Sticky header with backdrop blur on scroll.

## Motion (Framer Motion)

- Hero reveal (fade + up), section reveal on scroll, image fade-in, subtle card hover.
- Animate only `transform` / `opacity`.
- Respect `prefers-reduced-motion` (reduce/disable).

## Breakpoints

`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Mobile-first. Test 320→1920.

## Accessibility Baseline

- Real `<button>` / `<a>` elements, ARIA only when needed.
- Focus-visible rings everywhere. Alt text on every image.
- WCAG AA contrast for text.
- Keyboard operable: nav, modals, tabs, forms.