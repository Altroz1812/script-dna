import { Link } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Users,
  CreditCard,
  LogIn,
  Trash2,
  Tag,
  Percent,
  ShieldAlert,
  MapPin,
  User,
  Phone,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCart, type StudentDetail } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const STEPS = ["Sign In", "Student Details", "Address", "Review & Discounts", "Payment"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedStudentDetail extends StudentDetail {
  name: string;
  grade: string;
  email?: string;
  phone?: string;
  schoolName?: string;
}

interface AddressDetails {
  parentName: string;
  parentPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

type AuthStage =
  | "idle" // default: show sign-in button
  | "signing_in" // OAuth redirect in progress
  | "returning" // back from OAuth, processing hash
  | "promoting" // calling promote-to-parent edge fn
  | "role_conflict" // signed-in with non-parent, non-promotable role
  | "ready"; // authenticated as parent, proceed

// ─── Discount logic ───────────────────────────────────────────────────────────

function calculateDiscounts(
  items: { id: string; fee: number }[],
  studentDetails: Record<string, ExtendedStudentDetail[]>,
) {
  const courseCount = items.length;
  const subtotal = items.reduce((s, i) => s + (i.fee || 0), 0);

  let courseDiscount = 0;
  if (courseCount >= 3) courseDiscount = subtotal * 0.1;
  else if (courseCount === 2) courseDiscount = subtotal * 0.05;

  let studentDiscount = 0;
  for (const item of items) {
    const count = (studentDetails[item.id] || []).length;
    if (count >= 3) studentDiscount += (item.fee || 0) * 0.1;
    else if (count === 2) studentDiscount += (item.fee || 0) * 0.05;
  }

  const totalDiscount = courseDiscount + studentDiscount;
  return {
    subtotal,
    courseDiscount,
    studentDiscount,
    totalDiscount,
    final: Math.max(0, subtotal - totalDiscount),
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { items, removeItem, clearCart, setStudentDetails, getStudentDetails } = useCart();
  const { session, profile, loading: authLoading, signOut, refreshProfile } = useAuth();

  // Step & form state
  const [step, setStep] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"now" | "later" | null>(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [extendedStudentDetails, setExtendedStudentDetails] = useState<Record<string, ExtendedStudentDetail[]>>({});
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    parentName: "",
    parentPhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  // Auth stage machine
  const [authStage, setAuthStage] = useState<AuthStage>("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const promoteAttempted = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setIntent = () => {
    try {
      sessionStorage.setItem("checkout_signup_intent", "1");
    } catch {}
  };
  const clearIntent = useCallback(() => {
    try {
      sessionStorage.removeItem("checkout_signup_intent");
    } catch {}
  }, []);
  const hasIntent = () => {
    try {
      return sessionStorage.getItem("checkout_signup_intent") === "1";
    } catch {
      return false;
    }
  };

  // ── 1. Handle OAuth hash on return from Google ─────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;

    setAuthStage("returning");
    setAuthError(null);

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setAuthStage("idle");
      setAuthError("Sign-in failed — missing tokens. Please try again.");
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ data, error }) => {
        window.history.replaceState(null, "", window.location.pathname);
        if (error || !data?.session) {
          setAuthStage("idle");
          setAuthError("Could not restore session. Please sign in again.");
          return;
        }
        try {
          await refreshProfile();
        } catch {}
        // Stage will advance via the promotion effect below
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Promotion / role-resolution effect ─────────────────────────────────
  useEffect(() => {
    if (!session || !profile) return;
    if (promoteAttempted.current) return;

    // Already a parent — just advance
    if (profile.role === "parent") {
      clearIntent();
      setAuthStage("ready");
      if (step === 0) setStep(1);
      return;
    }

    // Roles that cannot be promoted (staff/admin)
    const nonPromotableRoles = ["superadmin", "admin", "support", "teacher"];
    if (nonPromotableRoles.includes(profile.role)) {
      clearIntent();
      setAuthStage("role_conflict");
      return;
    }

    // New user or student — attempt promotion to parent
    // Only promote when coming from checkout intent OR when on checkout page
    promoteAttempted.current = true;
    setAuthStage("promoting");
    setAuthError(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("promote-to-parent", { body: {} });
        if (error) throw error;

        if (data?.ok || data?.reason === "already_parent") {
          await refreshProfile();
          clearIntent();
          setAuthStage("ready");
          toast.success(data?.reason === "already_parent" ? "Welcome back!" : "Account ready for enrollment!");
          if (step === 0) setStep(1);
        } else if (data?.reason === "role_not_eligible") {
          clearIntent();
          setAuthStage("role_conflict");
        } else {
          throw new Error(data?.message || "Promotion failed");
        }
      } catch (e: any) {
        console.error("Promotion error:", e);
        clearIntent();
        setAuthStage("idle");
        setAuthError("Could not set up your account. Please try again or contact support.");
      }
    })();
  }, [session, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Force back to step 0 if session lost ────────────────────────────────
  useEffect(() => {
    if (!session && step > 0) {
      setStep(0);
      setAuthStage("idle");
      promoteAttempted.current = false;
    }
  }, [session, step]);

  // ── 4. Sync extended student details from cart ─────────────────────────────
  useEffect(() => {
    setExtendedStudentDetails((prev) => {
      const next: Record<string, ExtendedStudentDetail[]> = { ...prev };
      items.forEach((item) => {
        const existing = getStudentDetails(item.id) || [];
        if (!next[item.id] || next[item.id].length === 0) {
          next[item.id] =
            existing.length > 0
              ? existing.map((d: any) => ({
                  name: d.name || "",
                  grade: d.grade || "",
                  email: d.email || "",
                  phone: d.phone || "",
                  schoolName: d.schoolName || "",
                }))
              : [{ name: "", grade: "", email: "", phone: "", schoolName: "" }];
        }
      });
      Object.keys(next).forEach((id) => {
        if (!items.some((i) => i.id === id)) delete next[id];
      });
      return next;
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthStage("signing_in");
    setIntent();
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/checkout",
        extraParams: { prompt: "select_account" }, // always shows account picker
      });
      if (error) {
        setAuthStage("idle");
        setAuthError("Google sign-in failed: " + error.message);
        clearIntent();
      }
    } catch (err: any) {
      setAuthStage("idle");
      setAuthError("Failed to start sign-in. Please try again.");
      clearIntent();
    }
  };

  const handleSignOut = async () => {
    clearIntent();
    promoteAttempted.current = false;
    setAuthStage("idle");
    setAuthError(null);
    setStep(0);
    await signOut();
  };

  const allStudentDetailsFilled = items.every((item) => {
    const details = extendedStudentDetails[item.id] || [];
    return details.length > 0 && details.every((d) => d.name.trim() && d.grade.trim() && d.schoolName?.trim());
  });

  const isAddressValid = () =>
    addressDetails.parentName.trim() !== "" &&
    addressDetails.parentPhone.trim() !== "" &&
    addressDetails.addressLine1.trim() !== "" &&
    addressDetails.city.trim() !== "" &&
    addressDetails.state.trim() !== "" &&
    addressDetails.pincode.trim() !== "" &&
    addressDetails.country.trim() !== "";

  const disc = calculateDiscounts(items, extendedStudentDetails);
  const finalAmount = Math.max(0, disc.final - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        toast.error("Invalid or expired coupon");
        return;
      }

      const now = new Date();
      if (data.valid_until && new Date(data.valid_until) < now) {
        toast.error("This coupon has expired");
        return;
      }
      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error("Coupon usage limit reached");
        return;
      }
      if (data.min_amount && disc.final < Number(data.min_amount)) {
        toast.error(`Minimum order amount is ₹${data.min_amount}`);
        return;
      }

      const discountAmt =
        data.discount_type === "percentage"
          ? disc.final * (Number(data.discount_value) / 100)
          : Number(data.discount_value);

      setCouponDiscount(Math.min(discountAmt, disc.final));
      setCouponApplied(true);
      toast.success(`Coupon applied! ₹${Math.round(discountAmt)} off`);
    } catch {
      toast.error("Failed to validate coupon");
    }
  };

  const handleUpdateStudentDetails = (courseId: string, students: ExtendedStudentDetail[]) => {
    setExtendedStudentDetails((prev) => ({ ...prev, [courseId]: students }));
    setStudentDetails(
      courseId,
      students.map(({ name, grade }) => ({ name: name.trim(), grade: grade.trim() })),
    );
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (paymentMethod === "now" && !referenceNumber.trim()) {
      toast.error("Please enter the payment reference number");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        action: "create_order",
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          fee: i.fee,
          batch_id: i.batch_id,
          batch_name: i.batch_name,
        })),
        student_details: extendedStudentDetails,
        address_details: addressDetails,
        coupon_code: couponApplied ? couponCode.trim().toUpperCase() : null,
        payment_method: paymentMethod,
        reference_number: paymentMethod === "now" ? referenceNumber.trim() : null,
      };

      const { data, error } = await supabase.functions.invoke("cashfree-order", { body: payload });
      if (error) throw new Error(error.message || "Order creation failed");
      if (data?.error) throw new Error(data.error);

      setOrderId(data?.order_id || "");
      setSuccess(true);
      clearCart();
      toast.success(
        paymentMethod === "now" ? "Payment reference submitted!" : "Order submitted! We'll contact you soon.",
      );
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <CheckCircle className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Order Confirmed!</h1>
          {orderId && <p className="text-sm text-muted-foreground mb-2">Order ID: {orderId}</p>}
          <p className="text-muted-foreground mb-6">
            Thank you for your enrollment. We'll contact you shortly with next steps.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back to Courses</span>
          </Link>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Checkout
          </h1>
          {session && profile && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:block">{profile.email}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-xs">
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`text-xs font-medium ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
              {s}
            </div>
          ))}
        </div>
        <Progress value={(step / (STEPS.length - 1)) * 100} className="h-2" />
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {authLoading ? (
          <LoadingScreen message="Loading your session..." />
        ) : items.length === 0 ? (
          <EmptyCart />
        ) : authStage === "role_conflict" ? (
          <RoleBlocked role={profile?.role ?? "unknown"} email={profile?.email} onSignOut={handleSignOut} />
        ) : (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <AuthGateStep
                key="auth"
                authStage={authStage}
                authError={authError}
                profile={profile}
                onGoogleSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
              />
            )}
            {step === 1 && (
              <StudentDetailsStep
                key="students"
                items={items}
                removeItem={removeItem}
                studentDetails={extendedStudentDetails}
                setStudentDetails={handleUpdateStudentDetails}
              />
            )}
            {step === 2 && (
              <AddressStep key="address" addressDetails={addressDetails} setAddressDetails={setAddressDetails} />
            )}
            {step === 3 && (
              <DiscountSummaryStep
                key="discount"
                items={items}
                studentDetails={extendedStudentDetails}
                disc={disc}
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                couponDiscount={couponDiscount}
                couponApplied={couponApplied}
                handleApplyCoupon={handleApplyCoupon}
                finalAmount={finalAmount}
              />
            )}
            {step === 4 && (
              <PaymentStep
                key="payment"
                finalAmount={finalAmount}
                submitting={submitting}
                onPay={handlePayment}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                referenceNumber={referenceNumber}
                setReferenceNumber={setReferenceNumber}
              />
            )}
          </AnimatePresence>
        )}

        {/* Navigation */}
        {items.length > 0 && authStage !== "role_conflict" && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(session ? 1 : 0, s - 1))}
              disabled={step <= (session ? 1 : 0) || authStage === "promoting" || authStage === "returning"}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            {step < 4 && (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && authStage !== "ready") ||
                  (step === 1 && !allStudentDetailsFilled) ||
                  (step === 2 && !isAddressValid())
                }
              >
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyCart() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
      <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">Your cart is empty</h2>
      <p className="text-muted-foreground mb-6">Browse our courses and add some to get started.</p>
      <Button asChild>
        <Link to="/">Browse Courses</Link>
      </Button>
    </motion.div>
  );
}

function RoleBlocked({
  role,
  email,
  onSignOut,
}: {
  role: string;
  email?: string;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 max-w-md mx-auto"
    >
      <ShieldAlert className="mx-auto h-14 w-14 text-destructive mb-4" />
      <h2 className="text-2xl font-bold text-foreground mb-2">Different account type</h2>
      {email && <p className="text-sm text-muted-foreground mb-1">{email}</p>}
      <p className="text-muted-foreground mb-2">
        This account is registered as <span className="font-semibold capitalize">{role}</span>.
      </p>
      <p className="text-muted-foreground mb-6">
        Enrollment is only available for parent accounts. Please sign out and use a different Google account.
      </p>
      <div className="flex gap-3 justify-center">
        <Button variant="outline" asChild>
          <Link to="/">Back to Home</Link>
        </Button>
        <Button onClick={onSignOut}>Sign out &amp; switch account</Button>
      </div>
    </motion.div>
  );
}

// ─── Auth Gate Step ───────────────────────────────────────────────────────────

function AuthGateStep({
  authStage,
  authError,
  profile,
  onGoogleSignIn,
  onSignOut,
}: {
  authStage: AuthStage;
  authError: string | null;
  profile: any;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}) {
  const isLoading = authStage === "signing_in" || authStage === "returning" || authStage === "promoting";

  const loadingMessage =
    authStage === "signing_in"
      ? "Redirecting to Google..."
      : authStage === "returning"
        ? "Completing sign-in..."
        : "Setting up your account...";

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center py-16"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-6" />
          <h2 className="text-xl font-semibold text-foreground mb-2">{loadingMessage}</h2>
          <p className="text-muted-foreground text-sm">Please wait…</p>
        </>
      ) : (
        <>
          <LogIn className="h-14 w-14 text-primary mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Sign in to continue</h2>
          <p className="text-muted-foreground mb-2 text-center max-w-sm">
            Use your Google account to enroll. New accounts are automatically set up as parent accounts.
          </p>
          <p className="text-xs text-muted-foreground mb-8 text-center max-w-sm">
            You'll be asked to select or add a Google account. Existing users are signed in directly.
          </p>

          {/* Error alert */}
          {authError && (
            <Alert variant="destructive" className="mb-6 max-w-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          {/* Signed in but still idle (edge case) */}
          {profile && authStage === "idle" && (
            <Alert className="mb-6 max-w-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Signed in as <strong>{profile.email}</strong> but account setup is pending.{" "}
                <button className="underline" onClick={onSignOut}>
                  Sign out and try again
                </button>
                .
              </AlertDescription>
            </Alert>
          )}

          <Button size="lg" onClick={onGoogleSignIn} className="gap-3 px-8" disabled={isLoading}>
            <GoogleIcon />
            Continue with Google
          </Button>

          <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </>
      )}
    </motion.div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Student Details Step ─────────────────────────────────────────────────────

function StudentDetailsStep({
  items,
  removeItem,
  studentDetails,
  setStudentDetails,
}: {
  items: { id: string; name: string; fee: number; grade_level: string | null }[];
  removeItem: (id: string) => void;
  studentDetails: Record<string, ExtendedStudentDetail[]>;
  setStudentDetails: (id: string, s: ExtendedStudentDetail[]) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <Users className="mx-auto h-10 w-10 text-primary mb-2" />
        <h2 className="text-2xl font-bold text-foreground">Student Details</h2>
        <p className="text-muted-foreground">Tell us who will be enrolled in each course</p>
      </div>

      {items.length >= 2 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-primary">
            <Percent className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              {items.length >= 3 ? "10%" : "5%"} multi-course discount applied for {items.length} courses!
            </span>
          </CardContent>
        </Card>
      )}

      {items.map((item) => (
        <StudentCourseCard
          key={item.id}
          item={item}
          students={studentDetails[item.id] || []}
          onChange={(students) => setStudentDetails(item.id, students)}
          onRemove={() => removeItem(item.id)}
        />
      ))}
    </motion.div>
  );
}

function StudentCourseCard({
  item,
  students,
  onChange,
  onRemove,
}: {
  item: { id: string; name: string; fee: number; grade_level: string | null };
  students: ExtendedStudentDetail[];
  onChange: (s: ExtendedStudentDetail[]) => void;
  onRemove: () => void;
}) {
  useEffect(() => {
    if (students.length === 0) {
      onChange([{ name: "", grade: "", email: "", phone: "", schoolName: "" }]);
    }
  }, [students.length, onChange]);

  const addStudent = () => {
    if (students.length < 5) onChange([...students, { name: "", grade: "", email: "", phone: "", schoolName: "" }]);
  };
  const removeStudent = (idx: number) => onChange(students.filter((_, i) => i !== idx));
  const updateStudent = (idx: number, field: keyof ExtendedStudentDetail, value: string) => {
    const next = [...students];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{item.name}</CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">₹{item.fee?.toLocaleString() || "0"}</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {students.map((s, idx) => (
          <div key={`student-${idx}`} className="space-y-3 p-4 border rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-semibold">Student {idx + 1}</Label>
              {students.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStudent(idx)}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Student Name *</Label>
                <Input
                  placeholder="Full name"
                  value={s.name}
                  onChange={(e) => updateStudent(idx, "name", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Grade/Age *</Label>
                <Input
                  placeholder="e.g. Grade 3"
                  value={s.grade}
                  onChange={(e) => updateStudent(idx, "grade", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Student Phone (Optional)</Label>
                <Input
                  type="tel"
                  placeholder="Student's phone number"
                  value={s.phone || ""}
                  onChange={(e) => updateStudent(idx, "phone", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">For direct communication with student</p>
              </div>
              <div>
                <Label className="text-xs">Student Email (Optional)</Label>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={s.email || ""}
                  onChange={(e) => updateStudent(idx, "email", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">We'll send course updates to this email</p>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">School Name *</Label>
                <Input
                  placeholder="School name"
                  value={s.schoolName || ""}
                  onChange={(e) => updateStudent(idx, "schoolName", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        {students.length < 5 && (
          <Button variant="outline" size="sm" onClick={addStudent} className="w-full">
            + Add Another Student
          </Button>
        )}
        {students.length >= 2 && (
          <p className="text-xs text-primary flex items-center gap-1">
            <Percent className="h-3 w-3" />
            {students.length >= 3 ? "10%" : "5%"} multi-student discount applied!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Address Step ─────────────────────────────────────────────────────────────

function AddressStep({
  addressDetails,
  setAddressDetails,
}: {
  addressDetails: AddressDetails;
  setAddressDetails: (details: AddressDetails) => void;
}) {
  const update = (field: keyof AddressDetails, value: string) =>
    setAddressDetails({ ...addressDetails, [field]: value });

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <MapPin className="mx-auto h-10 w-10 text-primary mb-2" />
        <h2 className="text-2xl font-bold text-foreground">Parent/Guardian Details</h2>
        <p className="text-muted-foreground">Please provide parent/guardian contact and address</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Parent/Guardian Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="parentName">Full Name *</Label>
            <Input
              id="parentName"
              placeholder="Parent/Guardian name"
              value={addressDetails.parentName}
              onChange={(e) => update("parentName", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="parentPhone">Phone Number *</Label>
            <Input
              id="parentPhone"
              type="tel"
              placeholder="Phone number"
              value={addressDetails.parentPhone}
              onChange={(e) => update("parentPhone", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">We'll use this for enrollment communication</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="addressLine1">Address Line 1 *</Label>
            <Input
              id="addressLine1"
              placeholder="House/Flat No., Building Name"
              value={addressDetails.addressLine1}
              onChange={(e) => update("addressLine1", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input
              id="addressLine2"
              placeholder="Street, Area, Landmark"
              value={addressDetails.addressLine2}
              onChange={(e) => update("addressLine2", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="City"
                value={addressDetails.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="State"
                value={addressDetails.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pincode">PIN Code *</Label>
              <Input
                id="pincode"
                placeholder="PIN Code"
                value={addressDetails.pincode}
                onChange={(e) => update("pincode", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                placeholder="Country"
                value={addressDetails.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Discount Summary Step ────────────────────────────────────────────────────

function DiscountSummaryStep({
  items,
  studentDetails,
  disc,
  couponCode,
  setCouponCode,
  couponDiscount,
  couponApplied,
  handleApplyCoupon,
  finalAmount,
}: {
  items: { id: string; name: string; fee: number }[];
  studentDetails: Record<string, ExtendedStudentDetail[]>;
  disc: ReturnType<typeof calculateDiscounts>;
  couponCode: string;
  setCouponCode: (v: string) => void;
  couponDiscount: number;
  couponApplied: boolean;
  handleApplyCoupon: () => void;
  finalAmount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <Tag className="mx-auto h-10 w-10 text-primary mb-2" />
        <h2 className="text-2xl font-bold text-foreground">Order Summary</h2>
        <p className="text-muted-foreground">Review your enrollment details and discounts</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {items.map((item) => {
            const students = studentDetails[item.id] || [];
            return (
              <div key={item.id} className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {students.length} student{students.length !== 1 ? "s" : ""}:{" "}
                    {students.map((s) => s.name).join(", ")}
                  </p>
                  {students.some((s) => s.schoolName) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Schools: {students.map((s) => s.schoolName).join(", ")}
                    </p>
                  )}
                </div>
                <span className="font-medium text-foreground">₹{item.fee?.toLocaleString()}</span>
              </div>
            );
          })}

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₹{disc.subtotal.toLocaleString()}</span>
            </div>
            {disc.courseDiscount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Multi-course discount ({items.length >= 3 ? "10%" : "5%"})</span>
                <span>-₹{Math.round(disc.courseDiscount).toLocaleString()}</span>
              </div>
            )}
            {disc.studentDiscount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Multi-student discount</span>
                <span>-₹{Math.round(disc.studentDiscount).toLocaleString()}</span>
              </div>
            )}
            {couponApplied && couponDiscount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Coupon ({couponCode.toUpperCase()})</span>
                <span>-₹{Math.round(couponDiscount).toLocaleString()}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-between font-bold text-lg text-foreground">
            <span>Total</span>
            <span>₹{Math.round(finalAmount).toLocaleString()}</span>
          </div>

          {!couponApplied && (
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="uppercase"
              />
              <Button variant="outline" onClick={handleApplyCoupon} disabled={!couponCode.trim()}>
                Apply
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Payment Step ─────────────────────────────────────────────────────────────

function PaymentStep({
  finalAmount,
  submitting,
  onPay,
  paymentMethod,
  setPaymentMethod,
  referenceNumber,
  setReferenceNumber,
}: {
  finalAmount: number;
  submitting: boolean;
  onPay: () => void;
  paymentMethod: "now" | "later" | null;
  setPaymentMethod: (method: "now" | "later" | null) => void;
  referenceNumber: string;
  setReferenceNumber: (value: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-8"
    >
      <div className="text-center">
        <CreditCard className="h-16 w-16 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-foreground">Complete Your Enrollment</h2>
        <p className="text-4xl font-bold text-primary mt-4">₹{Math.round(finalAmount).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={`cursor-pointer transition-all ${paymentMethod === "now" ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
          onClick={() => setPaymentMethod("now")}
        >
          <CardContent className="p-6 text-center">
            <div className="text-2xl mb-3">💳</div>
            <h3 className="font-semibold text-lg">Pay Now</h3>
            <p className="text-sm text-muted-foreground mt-1">Scan QR and pay via UPI</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${paymentMethod === "later" ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
          onClick={() => setPaymentMethod("later")}
        >
          <CardContent className="p-6 text-center">
            <div className="text-2xl mb-3">📅</div>
            <h3 className="font-semibold text-lg">Pay Later</h3>
            <p className="text-sm text-muted-foreground mt-1">We'll contact you</p>
          </CardContent>
        </Card>
      </div>

      {paymentMethod === "now" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Scan to Pay</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <img
                src="/qrcode.png"
                alt="Payment QR Code"
                className="w-64 h-64 border rounded-xl shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/256x256?text=QR+Code";
                }}
              />
              <p className="text-sm text-muted-foreground text-center">
                Scan using any UPI app (Google Pay, PhonePe, Paytm, etc.)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Label htmlFor="ref">Payment Reference Number *</Label>
              <Input
                id="ref"
                placeholder="Enter UPI Reference / Transaction ID"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">Find this in your UPI payment confirmation</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {paymentMethod === "later" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-6 text-center">
            <p className="text-amber-700 dark:text-amber-400">
              We'll contact you shortly via email or phone to complete the enrollment.
            </p>
          </CardContent>
        </Card>
      )}

      {paymentMethod && (
        <Button
          size="lg"
          className="w-full"
          onClick={onPay}
          disabled={submitting || (paymentMethod === "now" && !referenceNumber.trim())}
        >
          {submitting
            ? "Submitting..."
            : paymentMethod === "now"
              ? `Confirm Payment${referenceNumber ? ` (Ref: ${referenceNumber})` : ""}`
              : "Submit Order - Pay Later"}
        </Button>
      )}
    </motion.div>
  );
}
