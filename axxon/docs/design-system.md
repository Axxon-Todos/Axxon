<!-- Documents the reusable monochrome visual system and its local component reference. -->
# Axxon design system

The platform uses one grayscale token system for both themes. The dark theme is the default. The light theme uses the same surface and action hierarchy.

## Open the live reference

Run `pnpm dev-next` from `axxon/`, then open `/design-system`. The reference includes the shared hero, buttons, badges, fields, surfaces, theme switch, and animated segmented control. This route returns 404 in production.

## Reuse the system

- `src/app/globals.css` owns semantic color tokens, flat surfaces, controls, and the landing composition.
- `src/components/ui/Button.tsx`, `Surface.tsx`, `Badge.tsx`, `PageHero.tsx`, and `SegmentedControl.tsx` are the shared product primitives.
- `src/lib/utils/brandColors.ts` supplies neutral default entity accents. Existing custom entity colors remain user data.
- Use Radix primitives for keyboard and accessibility behavior, Tailwind for layout, and Framer Motion for short entrance and layout transitions. Honor reduced motion.
- Prefer a page hero followed by plain sections with fine borders. Use a card only when it groups an interaction or data unit.

New screens should use CSS variables such as `var(--app-panel)`, `var(--app-border)`, and `var(--app-accent)` instead of hardcoded Tailwind palette colors. Keep diagrams and motion two-dimensional.

## Dashboard directory pattern

The main dashboard pairs `OrganizationList` with `DashboardProjects` under `DashboardOverview`. The organization list uses Radix Scroll Area and Tooltip primitives, while project rows use Framer Motion entrance and selection transitions. Each board query is scoped to the selected organization. Reuse this search, selection, and direct-link pattern for future directories, keeping feature-specific rows under `src/components/features`.
