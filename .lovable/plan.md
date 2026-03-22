

## Fix: Auth Gate + Cart Persistence for Checkout

### Root Cause
Two issues are breaking the checkout flow:

1. **Cart data is lost on Google sign-in** — The cart uses React state (`useState`), which resets when the page reloads during Google OAuth redirect. User adds courses → clicks checkout → signs in with Google → redirected back to `/checkout` → cart is empty.

2. **Auth gate gets bypassed** — If the user is already logged in (e.g., demo accounts), the checkout auto-advances past the sign-in step. For new customers coming from the landing page, the redirect wipes their cart.

### What Will Change

#### 1. Persist Cart in localStorage (`src/contexts/CartContext.tsx`)
- Replace `useState` with state that syncs to `localStorage` on every change
- On mount, hydrate cart items and student details from `localStorage`
- This ensures cart survives the Google OAuth redirect round-trip
- Clear `localStorage` when `clearCart()` is called

#### 2. Harden Auth Gate in CheckoutPage (`src/pages/CheckoutPage.tsx`)
- Step 0 (Sign In) is shown whenever `session` is null — this already works in code
- After Google OAuth redirect back to `/checkout`, the session will be set and cart will be restored from localStorage
- Add a loading state while auth is resolving to prevent flicker
- Disable the "Next" button entirely until session is confirmed
- Show the auth loading state from `useAuth()` so the page doesn't flash step 0 → step 1

#### 3. Handle Auth Loading State
- While `loading` is true from `useAuth()`, show a spinner instead of the auth gate or student details
- Once loading resolves: if no session → show auth gate; if session → advance to step 1

### Files to Modify
- `src/contexts/CartContext.tsx` — Add localStorage persistence for items and studentDetails
- `src/pages/CheckoutPage.tsx` — Add auth loading guard, ensure step 0 blocks properly

### Technical Notes
- localStorage keys: `aurapen_cart_items`, `aurapen_cart_students`
- Cart hydration happens once on mount; writes happen on every state change via `useEffect`
- No database changes needed

