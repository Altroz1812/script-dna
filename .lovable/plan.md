

## Replace Logo and Favicon with New AuraPen Image (Background Removed)

### What Will Happen

1. **Process the uploaded image** — Use the AI image generation model to remove the dark background from the uploaded logo, producing a transparent PNG.

2. **Replace `public/favicon.png`** — Copy the processed transparent logo to `public/favicon.png`, replacing the current file. This automatically updates the favicon (referenced in `index.html`) and all places that use `/favicon.png`.

3. **No code changes needed** — The logo is already referenced correctly across the app:
   - `index.html` → favicon
   - `LandingPage.tsx` → header and footer logos
   - `AppSidebar.tsx` → sidebar logo

### Files
- **Replace**: `public/favicon.png` with the new transparent-background logo
- **No code edits required** — all references already point to `/favicon.png`

