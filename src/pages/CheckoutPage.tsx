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
  // ALL HOOKS AT THE TOP IN CONSISTENT ORDER
  const { items, removeItem, clearCart, studentDetails, setStudentDetails, getStudentDetails } = useCart();
  const { session, profile, loading: authLoading, signOut, refreshProfile } = useAuth();

  // State hooks
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

  // ===== ADD THIS NEW useEffect =====
  // Handle OAuth redirect with hash fragment
  // Handle OAuth redirect with hash fragment
  // Handle OAuth redirect with hash fragment
  useEffect(() => {
    const hash = window.location.hash;

    if (hash && hash.includes("access_token=")) {
      console.log("Processing OAuth hash...");

      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(({ data, error }) => {
            if (!error && data?.session) {
              window.history.replaceState(null, "", window.location.pathname);
              setStep(1);
              clearSignupIntent();
              toast.success("Signed in successfully!");
            }
          });
      }
    }
  }, []);

  // ===== ADD THIS FUNCTION HERE =====
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

        {/* Navigation */}
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

/* ─── Sub-components ──────────────────────────────────── */

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

function RoleBlocked({ role, onSignOut }: { role: string; onSignOut: () => void | Promise<void> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 max-w-md mx-auto"
    >
      <ShieldAlert className="mx-auto h-14 w-14 text-destructive mb-4" />
      <h2 className="text-2xl font-bold text-foreground mb-2">Parent account required</h2>
      <p className="text-muted-foreground mb-6">
        This account is registered as <span className="font-semibold capitalize">{role}</span>. Checkout and enrollment
        payments are only available for parent accounts.
      </p>
      <div className="flex gap-3 justify-center">
        <Button variant="outline" asChild>
          <Link to="/">Back to Home</Link>
        </Button>
        <Button onClick={onSignOut}>Sign out</Button>
      </div>
    </motion.div>
  );
}

function AuthGateStep({ onGoogleSignIn }: { onGoogleSignIn: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <LogIn className="h-16 w-16 text-primary mb-6" />
      <h2 className="text-2xl font-bold text-foreground mb-2">Sign in to continue</h2>
      <p className="text-muted-foreground mb-8 text-center max-w-sm">
        Please sign in with your Google account to proceed with enrollment.
      </p>
      <Button size="lg" onClick={onGoogleSignIn} className="gap-2">
        {/* Google SVG icon */}
        Continue with Google
      </Button>
    </motion.div>
  );
}

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
              {items.length >= 3 ? "10%" : "5%"} multi-course discount applied for enrolling in {items.length} courses!
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
  const addStudent = () => {
    if (students.length < 5) {
      onChange([...students, { name: "", grade: "", email: "", phone: "", schoolName: "" }]);
    }
  };

  const removeStudent = (idx: number) => {
    onChange(students.filter((_, i) => i !== idx));
  };

  const updateStudent = (idx: number, field: keyof ExtendedStudentDetail, value: string) => {
    const newStudents = [...students];
    newStudents[idx] = { ...newStudents[idx], [field]: value };
    onChange(newStudents);
  };

  // Initialize if no students
  useEffect(() => {
    if (students.length === 0) {
      onChange([
        {
          name: "",
          grade: "",
          email: "",
          phone: "",
          schoolName: "",
        },
      ]);
    }
  }, [students.length, onChange]);

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

function AddressStep({
  addressDetails,
  setAddressDetails,
}: {
  addressDetails: AddressDetails;
  setAddressDetails: (details: AddressDetails) => void;
}) {
  const updateField = (field: keyof AddressDetails, value: string) => {
    setAddressDetails({ ...addressDetails, [field]: value });
  };

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
        <p className="text-muted-foreground">Please provide parent/guardian contact information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Parent/Guardian Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="parentName">Parent/Guardian Full Name *</Label>
            <Input
              id="parentName"
              placeholder="Enter parent/guardian name"
              value={addressDetails.parentName}
              onChange={(e) => updateField("parentName", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="parentPhone">Parent/Guardian Phone Number *</Label>
            <Input
              id="parentPhone"
              type="tel"
              placeholder="Enter phone number"
              value={addressDetails.parentPhone}
              onChange={(e) => updateField("parentPhone", e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">We'll use this for communication regarding enrollment</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Address Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="addressLine1">Address Line 1 *</Label>
            <Input
              id="addressLine1"
              placeholder="House/Flat No., Building Name"
              value={addressDetails.addressLine1}
              onChange={(e) => updateField("addressLine1", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input
              id="addressLine2"
              placeholder="Street, Area, Landmark"
              value={addressDetails.addressLine2}
              onChange={(e) => updateField("addressLine2", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="City"
                value={addressDetails.city}
                onChange={(e) => updateField("city", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="State"
                value={addressDetails.state}
                onChange={(e) => updateField("state", e.target.value)}
                required
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
                onChange={(e) => updateField("pincode", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                placeholder="Country"
                value={addressDetails.country}
                onChange={(e) => updateField("country", e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
          {/* Items */}
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

          {/* Coupon */}
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

      {/* Payment Method Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pay Now */}
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

        {/* Pay Later */}
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

      {/* Pay Now - QR Code & Reference */}
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
                Scan this QR code using any UPI app (Google Pay, PhonePe, Paytm, etc.)
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
              <p className="text-xs text-muted-foreground mt-2">You can find this in your UPI payment confirmation</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pay Later Message */}
      {paymentMethod === "later" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-6 text-center">
            <p className="text-amber-700 dark:text-amber-400">
              We'll contact you shortly via email or phone to complete the enrollment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
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
