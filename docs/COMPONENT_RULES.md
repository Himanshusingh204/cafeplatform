# COMPONENT_RULES.md

## Structure

```
components/
  ui/         # Primitives — Button, Input, Textarea, Label, Badge, Modal, Skeleton, Toast, Table
  layout/     # Header, Footer, MobileNav, Container
  home/  menu/  about/  gallery/  contact/  faq/  admin/   # Feature components
```

## Rules

1. **Small components.** Split when a file exceeds ~250 lines or holds multiple concerns.
2. **No duplicate UI.** Reuse `components/ui/*`. If a pattern repeats, promote it to a primitive.
3. **No random abstractions.** Don't create `utils2` or speculative generic components.
4. **Naming.** File = responsibility (`DishForm.tsx`, `MenuCategoryTabs.tsx`). Human-readable.
5. **Server vs Client.** Default to Server Components. Add `"use client"` only when needing state/effects/events. Keep client components thin.
6. **Props.** Explicit, typed, minimal. Use `children` composition over prop-drilling.
7. **Styling.** Tailwind utility classes using design tokens (`bg-primary`, `text-foreground`). No random hex in components.
8. **Accessibility.** Real elements, labels, focus-visible styles, keyboard support.
9. **States.** Every data component ships: loading skeleton, empty state, error state.
10. **Comments.** Explain *why*, not *what*.

## Do Not

- Don't make every tiny `<div>` a component.
- Don't build 1,000-line mega-components.
- Don't copy-paste UI; extract a shared primitive.
- Don't add unused libraries, hooks, or interfaces.
- Don't hard-code business data in components.