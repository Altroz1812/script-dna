

## Cashfree Payment Gateway + Enhanced Checkout Flow

### Overview
Rebuild the checkout flow into a multi-step process: (1) auth gate — force login/signup with Google, (2) student details collection per course, (3) discount calculation based on student count/course count, (4) Cashfree payment via edge function, (5) order confirmation.

### Step 1: Cashfree API Secret
- Use the `add_secret` tool to request the user's **Cashfree App ID** and **Secret Key** (test or production). These are needed in the edge function.

### Step 2: Database Changes (Migration)
- Create an `orders` table to track checkout orders:
  - `id`, `user_id`, `total_amount`, `discount_amount`, `final_amount`, `status` (pending/paid/failed), `cashfree_order_id`, `payment_session_id`, `student_details` (jsonb — array of student names per course), `created_at`, `updated_at`
- Add RLS: users can read their own orders; admins/superadmins can manage all.

### Step 3: Edge Function — `cashfree-order`
- Accepts: `{ items, student_details, discount_amount, final_amount }`
- Validates the logged-in user (JWT from Authorization header)
- Creates a row in `orders` table
- Calls Cashfree "Create Order" API (`https://api.cashfree.com/pg/orders` or sandbox equivalent) with the order amount and customer details
- Returns `payment_session_id` to the frontend for the Cashfree JS SDK drop-in

### Step 4: Edge Function — `cashfree-webhook`
- Receives Cashfree payment notifications
- Verifies signature using the secret key
- Updates `orders.status` to `paid` or `failed`
- On success: creates `payments` records and a `leads` entry

### Step 5: Checkout Page Rebuild (`CheckoutPage.tsx`)
Multi-step flow with these screens:

1. **Auth Gate** — If not logged in, show a "Sign in to continue" screen with Google Sign-In button. Redirect back to `/checkout` after auth.

2. **Student Details** — For each course in cart, ask: "How many students?" and collect each student's name and age/grade. Store in local state.

3. **Discount Summary** — Calculate discounts:
   - 2 courses → 5% off
   - 3+ courses → 10% off
   - 2 students per course → 5% off per course
   - 3+ students per course → 10% off per course
   - Also apply coupon codes (existing `coupons` table)
   - Show itemized breakdown with discount applied

4. **Payment** — Load Cashfree JS SDK (`https://sdk.cashfree.com/js/v3/cashfree.js`), call the edge function to create order, then open Cashfree payment drop-in. On success/failure, show result.

5. **Confirmation** — Order success screen with order ID.

### Step 6: CartContext Update
- Add `studentDetails` map to cart context: `Record<courseId, { name: string; grade: string }[]>`
- Add helper to set/get student details per course item

### Step 7: Google Sign-In Integration
- Use the existing Lovable Cloud managed Google OAuth (configure via Social Login tool)
- Add a Google sign-in button on the checkout auth gate step

### Files to Create/Modify
- **Create**: `supabase/functions/cashfree-order/index.ts`
- **Create**: `supabase/functions/cashfree-webhook/index.ts`
- **Modify**: `src/pages/CheckoutPage.tsx` (complete rewrite — multi-step)
- **Modify**: `src/contexts/CartContext.tsx` (add student details)
- **Migration**: Create `orders` table

### Technical Details
- Cashfree JS SDK loaded via `<script>` tag dynamically
- Payment mode: Cashfree Drop (embedded checkout)
- Discount logic is client-side for display but validated server-side in the edge function
- Webhook endpoint does not require JWT (public endpoint with signature verification)

