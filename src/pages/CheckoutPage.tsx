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
  School,
  Mail,
  User,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCart, type StudentDetail } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const STEPS = ["Sign In", "Student Details", "Address", "Review & Discounts", "Payment"];

// Extended StudentDetail with email and school
interface ExtendedStudentDetail extends StudentDetail {
  name: string;
  grade: string;
  email?: string;
  phone?: string;
  schoolName?: string;
}

// Discount logic
function calculateDiscounts(
  items: { id: string; fee: number }[],
  studentDetails: Record<string, ExtendedStudentDetail[]>,
) {
  let courseDiscount = 0;
  const courseCount = items.length;
  const subtotal = items.reduce((s, i) => s + (i.fee || 0), 0);

  if (courseCount >= 3) courseDiscount = subtotal * 0.1;
  else if (courseCount === 2) courseDiscount = subtotal * 0.05;

  let studentDiscount = 0;
  for (const item of items) {
    const students = studentDetails[item.id] || [];
    const count = students.length;
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

// Address type
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

export default function CheckoutPage() {
  // ALL HOOKS MUST BE AT THE TOP, IN THE SAME ORDER EVERY RENDER
  const { items, removeItem, clearCart, studentDetails, setStudentDetails, getStudentDetails } = useCart();
  const { session, profile, loading: authLoading, signOut, refreshProfile } = useAuth();

  // State hooks - all at the top
  const [step, setStep] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [hasSignupIntent, setHasSignupIntent] = useState<boolean>(false);
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

  // Ref hooks
  const promoteAttempted = useRef(false);

  // Initialize hasSignupIntent from sessionStorage
  useEffect(() => {
    try {
      const intent = sessionStorage.getItem("checkout_signup_intent") === "1";
      setHasSignupIntent(intent);
    } catch {
      // Ignore errors
    }
  }, []);

  // Callback hooks
  const clearSignupIntent = useCallback(() => {
    try {
      sessionStorage.removeItem("checkout_signup_intent");
    } catch {}
    setHasSignupIntent(false);
  }, []);

  // Initialize extended student details from cart context
  useEffect(() => {
    setExtendedStudentDetails((prev) => {
      const newExtended: Record<string, ExtendedStudentDetail[]> = { ...prev };

      items.forEach((item) => {
        const existing = getStudentDetails(item.id) || [];

        if (!newExtended[item.id] || newExtended[item.id].length === 0) {
          newExtended[item.id] =
            existing.length > 0
              ? existing.map((d: any) => ({
                  name: d.name || "",
                  grade: d.grade || "",
                  email: d.email || "",
                  phone: d.phone || "",
                  schoolName: d.schoolName || "",
                }))
              : [{ name: "", grade: "", email: "", phone: "", schoolName: "" }];
        } else {
          newExtended[item.id] = newExtended[item.id].map((student, idx) => {
            const base = existing[idx] || { name: "", grade: "" };
            return {
              ...student,
              name: base.name || student.name || "",
              grade: base.grade || student.grade || "",
            };
          });
        }
      });

      // Clean up courses that were removed
      Object.keys(newExtended).forEach((courseId) => {
        if (!items.some((item) => item.id === courseId)) {
          delete newExtended[courseId];
        }
      });

      return newExtended;
    });
  }, [items]);

  // Promote to parent logic
  useEffect(() => {
    if (!session || !profile || promoteAttempted.current) return;
    if (profile.role === "parent") {
      clearSignupIntent();
      return;
    }

    const intent = (() => {
      try {
        return sessionStorage.getItem("checkout_signup_intent") === "1";
      } catch {
        return false;
      }
    })();

    if (!intent) return;

    promoteAttempted.current = true;
    setPromoting(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("promote-to-parent", { body: {} });

        if (error) throw error;

        if (data?.ok) {
          await refreshProfile();
          toast.success("Account set up as parent");
        } else if (data?.reason === "role_not_eligible" || data?.reason === "already_parent") {
          toast.info("Continuing with existing account");
        } else {
          toast.error(data?.message || "Failed to set up parent account");
        }
      } catch (e: any) {
        console.error("Promotion error:", e);
        toast.info("Continuing checkout...");
      } finally {
        clearSignupIntent();
        setPromoting(false);
      }
    })();
  }, [session, profile, refreshProfile, clearSignupIntent]);

  // Auto-advance after login
  useEffect(() => {
    if (session && profile?.role === "parent" && step === 0) {
      setStep(1);
      clearSignupIntent();
    }
  }, [session, profile, step, clearSignupIntent]);

  // Force auth step if not logged in
  useEffect(() => {
    if (!session && step > 0) setStep(0);
  }, [session, step]);

  const handleGoogleSignIn = async () => {
    try {
      try {
        sessionStorage.setItem("checkout_signup_intent", "1");
      } catch {}
      setHasSignupIntent(true);

      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/checkout",
        extraParams: { prompt: "select_account" },
      });

      if (error) {
        toast.error("Sign-in failed: " + error.message);
        clearSignupIntent();
      }
    } catch (err: any) {
      toast.error("Failed to start Google sign in");
      clearSignupIntent();
    }
  };

  const handleSignOut = async () => {
    clearSignupIntent();
    await signOut();
  };

  const allStudentDetailsFilled = items.every((item) => {
    const details = extendedStudentDetails[item.id] || [];
    return details.length > 0 && details.every((d) => d.name.trim() && d.grade.trim() && d.schoolName.trim());
  });

  const isAddressValid = () => {
    return (
      addressDetails.parentName.trim() !== "" &&
      addressDetails.parentPhone.trim() !== "" &&
      addressDetails.addressLine1.trim() !== "" &&
      addressDetails.city.trim() !== "" &&
      addressDetails.state.trim() !== "" &&
      addressDetails.pincode.trim() !== "" &&
      addressDetails.country.trim() !== ""
    );
  };

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
        .single();

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
        toast.error("This coupon has reached its usage limit");
        return;
      }
      if (data.min_amount && disc.final < Number(data.min_amount)) {
        toast.error(`Minimum order amount is ₹${data.min_amount}`);
        return;
      }

      let discountAmt = 0;
      if (data.discount_type === "percentage") {
        discountAmt = disc.final * (Number(data.discount_value) / 100);
      } else {
        discountAmt = Number(data.discount_value);
      }

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
      students.map(({ name, grade }) => ({
        name: name.trim(),
        grade: grade.trim(),
      })),
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

      const { data, error } = await supabase.functions.invoke("cashfree-order", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Order creation failed");
      if (data?.error) throw new Error(data.error);

      setOrderId(data?.order_id || "");
      setSuccess(true);
      clearCart();

      toast.success(
        paymentMethod === "now"
          ? "Payment reference submitted successfully!"
          : "Order submitted! We will contact you soon.",
      );
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
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
        </div>
      </header>

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
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Loading your session...</p>
          </div>
        ) : items.length === 0 && !success ? (
          <EmptyCart />
        ) : session && profile && profile.role !== "parent" && !promoting && !hasSignupIntent ? (
          <RoleBlocked role={profile.role} onSignOut={handleSignOut} />
        ) : (
          <AnimatePresence mode="wait">
            {step === 0 && <AuthGateStep key="auth" onGoogleSignIn={handleGoogleSignIn} />}
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

        {items.length > 0 && !success && (!session || profile?.role === "parent") && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(session ? 1 : 0, s - 1))}
              disabled={step <= (session ? 1 : 0)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>

            {step < 4 && (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && !session) ||
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

// Sub-components remain the same...
// (EmptyCart, RoleBlocked, AuthGateStep, StudentDetailsStep,
//  StudentCourseCard, AddressStep, DiscountSummaryStep, PaymentStep)
