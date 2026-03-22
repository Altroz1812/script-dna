

## Rebuild Checkout: Multi-Step with Auth Gate + Student Details

### Problem
The current checkout page is a simple contact form — no Google sign-in requirement, no student details collection per course, and no discount logic. The approved plan called for a multi-step flow but it was never implemented.

### What Will Change

#### 1. Configure Google OAuth (Social Login)
- Use the Configure Social Login tool to set up Google sign-in via Lovable Cloud's managed OAuth
- This generates the `src/integrations/lovable/` module automatically

#### 2. Update CartContext (`src/contexts/CartContext.tsx`)
- Add `studentDetails: Record<string, { name: string; grade: string }[]>` to track students per course
- Add `setStudentDetails(courseId, students)` and `getStudentDetails(courseId)` helpers

#### 3. Complete Rewrite of CheckoutPage (`src/pages/CheckoutPage.tsx`)
Multi-step wizard with 4 steps:

**Step 1 — Auth Gate**: If user is not logged in, show a full-screen prompt with Google Sign-In button (using `lovable.auth.signInWithOAuth("google")`). No manual contact form. User must sign in to proceed.

**Step 2 — Student Details**: For each course in cart, show a card asking "How many students will enroll?" with a number selector (1-5). For each student, collect name and grade/age. All fields required before proceeding.

**Step 3 — Discount & Summary**: Show itemized breakdown with automatic discounts:
- 2 courses → 5% off subtotal
- 3+ courses → 10% off subtotal
- 2 students in a course → 5% off that course
- 3+ students in a course → 10% off that course
- Optional coupon code field (validates against `coupons` table)
- Clear display of original price, discount amount, and final total

**Step 4 — Payment & Confirmation**: Call the `cashfree-order` edge function to create an order, load Cashfree JS SDK, open payment drop-in. Show success/failure result.

#### 4. Update `cashfree-order` Edge Function
- Add `create_order` action: accepts cart items, student details, calculates discount server-side, creates order in `orders` table, calls Cashfree API, returns `payment_session_id`
- Add `verify_payment` action: verifies payment status after completion

#### 5. Create `orders` Table (Migration)
```sql
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  total_amount numeric NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  cashfree_order_id text,
  payment_session_id text,
  student_details jsonb NOT NULL DEFAULT '[]',
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: users read own orders, admins manage all
```

### Files
- **Configure**: Google Social Login via tool
- **Migration**: Create `orders` table with RLS
- **Modify**: `src/contexts/CartContext.tsx` — add student details state
- **Rewrite**: `src/pages/CheckoutPage.tsx` — 4-step wizard
- **Modify**: `supabase/functions/cashfree-order/index.ts` — add order creation + Cashfree API call

### Technical Notes
- Google OAuth uses `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` — no custom credentials needed
- Discount calculation happens both client-side (for display) and server-side (in edge function, for validation)
- Cashfree JS SDK loaded dynamically via script tag when reaching payment step
- The `orders` table stores `student_details` as JSONB for flexibility

