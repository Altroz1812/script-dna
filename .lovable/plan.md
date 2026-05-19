## Add AuraPen Logo (Transparent)

### 1. Asset processing
- Run `imagegen--edit_image` on `user-uploads://Gemini_Generated_Image_q6yd6nq6yd6nq6yd.png` with `transparent_background: true` to strip the checkerboard and produce a clean PNG.
- Save to `src/assets/aurapen-logo.png` (imported as ES6 module for bundling).
- Also copy a square mark-only crop to `public/favicon.png` and update `index.html` `<link rel="icon">` + `og:image`.

### 2. Wire logo into brand surfaces (presentation only)
- **`src/components/layout/AppSidebar.tsx`** — replace current brand mark (gradient square + text) with `<img src={logo} />` + "AuraPen" wordmark. Keep collapsed-state behavior (icon only).
- **`src/components/layout/AppHeader.tsx`** — small logo on mobile where the sidebar trigger sits, if a brand slot exists.
- **`src/pages/Login.tsx`** — swap the animated `GraduationCap` gradient tile for the new logo (keep the subtle float animation, drop the gradient bg since the logo already carries brand color).
- **`src/pages/LandingPage.tsx`** — use logo in the top nav and as a hero accent.
- **`src/pages/Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`** — same header swap as Login for consistency.

### 3. Out of scope
- Vercel SPA 404 fix (separate concern from prior message — flag to address next if desired).
- Recoloring the logo or generating variants.

### Files touched
```
src/assets/aurapen-logo.png            (new)
public/favicon.png                     (new/overwrite)
index.html                             (favicon + og:image)
src/components/layout/AppSidebar.tsx
src/components/layout/AppHeader.tsx
src/pages/Login.tsx
src/pages/Signup.tsx
src/pages/ForgotPassword.tsx
src/pages/ResetPassword.tsx
src/pages/LandingPage.tsx
```

### Verification
Visit `/`, `/login`, `/signup`, `/dashboard` — logo renders crisp with no checkerboard, scales correctly on mobile, favicon updates in browser tab.