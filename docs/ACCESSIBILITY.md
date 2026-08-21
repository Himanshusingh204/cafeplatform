# ACCESSIBILITY.md

## Baseline

- WCAG 2.1 AA targets for contrast and usability.
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, headings in order.
- One `h1` per page.

## Keyboard

- Full keyboard navigation: nav, mobile drawer, modals (focus trap + Escape), category tabs, forms.
- Visible `:focus-visible` rings on all interactive elements.
- No keyboard traps.

## Forms

- Every input has an associated `<label>`.
- Error messages linked via `aria-describedby`.
- `aria-invalid` on invalid fields.
- Required marked with `*` + `aria-required`.
- Form submit has loading/disabled state.

## Buttons & Links

- Real `<button>` / `<a>`. Never `<div onClick>`.
- Descriptive accessible names ("Open mobile menu", not "Menu ☰").
- Links with target blank get `rel="noopener noreferrer"` + visible indication.

## Images

- Every `<img>` has meaningful `alt`. Decorative images get `alt=""`.
- Gallery images require admin-provided alt text.

## Modals / Drawers

- Focus moved into dialog on open, trapped, restored on close.
- `role="dialog"` + `aria-modal` where custom.
- Escape closes; backdrop click closes.

## Motion

- `prefers-reduced-motion` respected: reduce/disable Framer Motion, transitions, marquees.

## Focus & Color

- Focus indicators ≥ 3:1 against adjacent colors.
- Text contrast ≥ 4.5:1 (large text 3:1).
- Color is never the only status signal (use text + icon).

## Testing

- Keyboard-only pass through every page.
- Basic screen-reader pass (landmarks, labels, alt).
- Contrast audit of all text colors.
- Axe checks in CI where configured.