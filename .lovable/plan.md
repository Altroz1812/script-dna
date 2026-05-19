
# New Brand Palette Rollout — Royal Blue + Gold

## Palette (locked)
- Primary: `#3B82F6` (royal blue)
- Secondary / luxury accent: `#D4AF37` (gold)
- Background: `#0B1020` (deep navy)
- Surface / card: `#111827`
- Text primary: `#F8FAFC`
- Border: `#374151`
- Glow: `#00BFFF` (cyan)

All values stored as HSL in `index.css`, consumed via `hsl(var(--token))`.

## Scope
1. **Theme tokens (global, instant impact)** — `src/index.css` + `tailwind.config.ts`
2. **Refresh key surfaces** — Landing, Login, Dashboard, AppSidebar, AppHeader
3. No business-logic, route, RLS, or data changes.

## 1. Token updates (`src/index.css`)
Replace `:root` block with new HSL equivalents:
- `--background: 226 47% 8%` (#0B1020)
- `--card: 220 26% 12%` (#111827)
- `--popover: 220 26% 12%`
- `--foreground: 210 40% 98%` (#F8FAFC)
- `--primary: 217 91% 60%` (#3B82F6) / `--primary-foreground: 0 0% 100%`
- `--secondary: 220 20% 18%` (surface step)
- `--accent: 43 65% 52%` (#D4AF37 — gold)  / `--accent-foreground: 226 47% 8%`
- `--muted: 220 20% 14%` / `--muted-foreground: 215 16% 65%`
- `--border: 220 14% 28%` (#374151) / `--input: 220 20% 16%` / `--ring: 217 91% 60%`
- Add `--glow: 195 100% 50%` (#00BFFF)
- Sidebar tokens recolored to navy/blue family.

Update gradients & shadows:
- `--gradient-accent: linear-gradient(135deg, hsl(217 91% 60%), hsl(195 100% 50%), hsl(43 65% 52%))`
- `--gradient-gold: linear-gradient(135deg, hsl(43 65% 52%), hsl(43 80% 70%))`
- `--gradient-blue-glow: linear-gradient(135deg, hsl(217 91% 60%), hsl(195 100% 50%))`
- `--shadow-glow-primary: 0 0 40px hsl(217 91% 60% / 0.25)`
- `--shadow-glow-gold: 0 0 32px hsl(43 65% 52% / 0.25)`
- `--shadow-glow-cyan: 0 0 40px hsl(195 100% 50% / 0.30)`
- `--shadow-depth` re-tinted with new primary.

Remove now-unused vivid coral/mint tokens but keep aliases so existing classes don't crash:
- `--coral` → maps to gold (`43 65% 52%`)
- keep `--success`, `--warning`, `--destructive` largely as-is, just slightly muted to match palette.

## 2. Tailwind config (`tailwind.config.ts`)
- Add `gold: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' }`
- Add `glow: 'hsl(var(--glow))'`
- Keep `coral` alias pointing to `--coral` (now gold) so legacy classes still render.
- New keyframe `glow-pulse-cyan` and animation utility.

## 3. Key surface refresh (presentation only)

### `src/components/layout/AppSidebar.tsx`
- Active nav item: blue→cyan gradient pill, gold left-bar indicator.
- Hover: cyan glow ring.
- Brand mark uses gold accent dot.

### `src/components/layout/AppHeader.tsx`
- Subtle bottom border in `--border` with cyan glow underline on scroll.
- Org switcher chip: gold ring on hover.
- NotificationsBell unread dot → gold.

### `src/pages/LandingPage.tsx`
- Hero headline: blue→cyan→gold text-gradient.
- Primary CTA: blue with cyan glow; secondary CTA: gold outline.
- Pricing/featured cards: gold gradient border on "recommended", cyan glow on hover.
- Background morphing gradient retuned to blue/cyan with subtle gold blob.

### `src/pages/Login.tsx` (+ Signup, Forgot, Reset — same shell)
- Glass card with cyan glow halo behind it.
- "Sign in" button blue with cyan glow.
- Demo login cards keep layout; accent border → gold for SuperAdmin/Admin, blue for others.

### `src/pages/Dashboard.tsx`
- StatCards: blue icon chips, gold trend arrows for positive deltas, glow on hover.
- Charts re-tinted: primary series blue, secondary gold, tertiary cyan (Recharts color props).
- BentoGrid hero card: animated gold→blue gradient border.

### `src/components/ui/tilt-card.tsx` & `morphing-blob.tsx`
- Default `glowColor` swapped from purple to `hsl(var(--glow))` (cyan).
- Blob default tint shifted to blue.

## 4. Component sweep (low-touch)
- Buttons: `default` already uses `--primary` (blue now). Add new variant `gold` (gradient gold) and `glow` (blue + cyan shadow) for marketing surfaces. Do **not** change existing usages of `default`/`destructive`/etc.
- Badges: add `gold` variant; leave existing ones alone.
- Any hard-coded purple/coral utility classes inside the 5 refreshed pages get swapped to tokens.

## 5. Out of scope (deferred)
- Migrating all 50+ inner pages (Users, Roles, Courses, Batches, etc.) — they automatically inherit the new tokens; visual polish comes in the later full refactor.
- Light theme variant.
- i18n & white-label.

## Verification
1. Visit `/`, `/login`, `/dashboard`, `/font-compiler`, `/users` — confirm new palette, no contrast regressions.
2. Check Recharts colors render correctly.
3. Spot-check buttons/badges in destructive/warning/success states.
4. Reduced-motion: glow pulses respect `prefers-reduced-motion`.

## Files touched
```
src/index.css                              (tokens, gradients, shadows)
tailwind.config.ts                         (gold, glow color, keyframes)
src/components/ui/button.tsx               (+ gold, glow variants)
src/components/ui/badge.tsx                (+ gold variant)
src/components/ui/tilt-card.tsx            (default glow → cyan)
src/components/ui/morphing-blob.tsx        (default tint → blue)
src/components/layout/AppSidebar.tsx       (active state, brand)
src/components/layout/AppHeader.tsx       (border glow, accents)
src/components/layout/NotificationsBell.tsx (dot → gold)
src/pages/LandingPage.tsx                  (hero, CTAs, cards)
src/pages/Login.tsx                        (glass halo, button glow)
src/pages/Dashboard.tsx                    (stat/chart accents)
mem://style/theme                          (record new palette)
```

## Memory update
After implementation, update `mem://style/theme` with the locked palette so future work stays on-brand.
