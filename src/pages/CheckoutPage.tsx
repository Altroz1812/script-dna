import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ArrowLeft, ArrowRight, CheckCircle, Users, CreditCard, LogIn, Trash2, Tag, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useCart, type StudentDetail } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

const STEPS = ['Sign In', 'Student Details', 'Review & Discounts', 'Payment'];

// Discount logic
function calculateDiscounts(items: { id: string; fee: number }[], studentDetails: Record<string, StudentDetail[]>) {
  let courseDiscount = 0;
  const courseCount = items.length;
  const subtotal = items.reduce((s, i) => s + (i.fee || 0), 0);

  // Multi-course discount on subtotal
  if (courseCount >= 3) courseDiscount = subtotal * 0.10;
  else if (courseCount === 2) courseDiscount = subtotal * 0.05;

  // Per-course student discount
  let studentDiscount = 0;
  for (const item of items) {
    const students = studentDetails[item.id] || [];
    const count = students.length;
    if (count >= 3) studentDiscount += (item.fee || 0) * 0.10;
    else if (count === 2) studentDiscount += (item.fee || 0) * 0.05;
  }

  const totalDiscount = courseDiscount + studentDiscount;
  return { subtotal, courseDiscount, studentDiscount, totalDiscount, final: Math.max(0, subtotal - totalDiscount) };
}

export default function CheckoutPage() {
  const { items, removeItem, clearCart, studentDetails, setStudentDetails, getStudentDetails } = useCart();
  const { session, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  // Auto-advance past auth step if logged in
  useEffect(() => {
    if (session && step === 0) setStep(1);
  }, [session, step]);

  // If not logged in, force step 0
  useEffect(() => {
    if (!session && step > 0) setStep(0);
  }, [session, step]);

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin + '/checkout',
    });
    if (error) toast.error('Sign-in failed: ' + (error as Error).message);
  };

  const allStudentDetailsFilled = items.every(item => {
    const details = getStudentDetails(item.id);
    return details.length > 0 && details.every(d => d.name.trim() && d.grade.trim());
  });

  const disc = calculateDiscounts(items, studentDetails);
  const finalAmount = Math.max(0, disc.final - couponDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast.error('Invalid or expired coupon');
        return;
      }

      const now = new Date();
      if (data.valid_until && new Date(data.valid_until) < now) {
        toast.error('This coupon has expired');
        return;
      }
      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error('This coupon has reached its usage limit');
        return;
      }
      if (data.min_amount && disc.final < Number(data.min_amount)) {
        toast.error(`Minimum order amount is ₹${data.min_amount}`);
        return;
      }

      let discountAmt = 0;
      if (data.discount_type === 'percentage') {
        discountAmt = disc.final * (Number(data.discount_value) / 100);
      } else {
        discountAmt = Number(data.discount_value);
      }

      setCouponDiscount(Math.min(discountAmt, disc.final));
      setCouponApplied(true);
      toast.success(`Coupon applied! ₹${Math.round(discountAmt)} off`);
    } catch {
      toast.error('Failed to validate coupon');
    }
  };

  const handlePayment = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cashfree-order', {
        body: {
          action: 'create_order',
          items: items.map(i => ({ id: i.id, name: i.name, fee: i.fee })),
          student_details: studentDetails,
          coupon_code: couponApplied ? couponCode.trim().toUpperCase() : null,
        },
      });

      if (error) throw new Error(error.message || 'Order creation failed');
      if (data?.error) throw new Error(data.error);

      if (data?.payment_session_id && data?.cashfree_order_id) {
        // Load Cashfree SDK and open payment
        await loadCashfreeSDK();
        const cashfree = (window as any).Cashfree({ mode: data.mode === 'production' ? 'production' : 'sandbox' });
        const result = await cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_modal' });

        if (result.error) {
          toast.error('Payment failed: ' + result.error.message);
        } else if (result.paymentDetails) {
          setOrderId(data.cashfree_order_id);
          setSuccess(true);
          clearCart();
          toast.success('Payment successful!');
        }
      } else {
        // No Cashfree configured — order created as pending
        setOrderId(data?.order_id || '');
        setSuccess(true);
        clearCart();
        toast.success('Order submitted successfully!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <CheckCircle className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Order Confirmed!</h1>
          {orderId && <p className="text-sm text-muted-foreground mb-2">Order ID: {orderId}</p>}
          <p className="text-muted-foreground mb-6">Thank you for your enrollment. We'll contact you shortly with next steps.</p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
            <Button asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
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
            <div key={s} className={`text-xs font-medium ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</div>
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
        ) : (
          <AnimatePresence mode="wait">
            {step === 0 && <AuthGateStep key="auth" onGoogleSignIn={handleGoogleSignIn} />}
            {step === 1 && (
              <StudentDetailsStep
                key="students"
                items={items}
                removeItem={removeItem}
                getStudentDetails={getStudentDetails}
                setStudentDetails={setStudentDetails}
              />
            )}
            {step === 2 && (
              <DiscountSummaryStep
                key="discount"
                items={items}
                studentDetails={studentDetails}
                disc={disc}
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                couponDiscount={couponDiscount}
                couponApplied={couponApplied}
                handleApplyCoupon={handleApplyCoupon}
                finalAmount={finalAmount}
              />
            )}
            {step === 3 && (
              <PaymentStep
                key="payment"
                finalAmount={finalAmount}
                submitting={submitting}
                onPay={handlePayment}
              />
            )}
          </AnimatePresence>
        )}

        {/* Navigation */}
        {items.length > 0 && !success && (
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => setStep(s => Math.max(session ? 1 : 0, s - 1))} disabled={step <= (session ? 1 : 0)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={
                  (step === 0 && !session) ||
                  (step === 1 && !allStudentDetailsFilled)
                }
              >
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : null}
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
      <Button asChild><Link to="/">Browse Courses</Link></Button>
    </motion.div>
  );
}

function AuthGateStep({ onGoogleSignIn }: { onGoogleSignIn: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col items-center justify-center py-16">
      <LogIn className="h-16 w-16 text-primary mb-6" />
      <h2 className="text-2xl font-bold text-foreground mb-2">Sign in to continue</h2>
      <p className="text-muted-foreground mb-8 text-center max-w-sm">
        Please sign in with your Google account to proceed with enrollment.
      </p>
      <Button size="lg" onClick={onGoogleSignIn} className="gap-2">
        <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Continue with Google
      </Button>
    </motion.div>
  );
}

function StudentDetailsStep({
  items, removeItem, getStudentDetails, setStudentDetails,
}: {
  items: { id: string; name: string; fee: number; grade_level: string | null }[];
  removeItem: (id: string) => void;
  getStudentDetails: (id: string) => StudentDetail[];
  setStudentDetails: (id: string, s: StudentDetail[]) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
      <div className="text-center mb-6">
        <Users className="mx-auto h-10 w-10 text-primary mb-2" />
        <h2 className="text-2xl font-bold text-foreground">Student Details</h2>
        <p className="text-muted-foreground">Tell us who will be enrolled in each course</p>
      </div>

      {items.map(item => (
        <StudentCourseCard
          key={item.id}
          item={item}
          students={getStudentDetails(item.id)}
          onChange={(students) => setStudentDetails(item.id, students)}
          onRemove={() => removeItem(item.id)}
        />
      ))}
    </motion.div>
  );
}

function StudentCourseCard({
  item, students, onChange, onRemove,
}: {
  item: { id: string; name: string; fee: number; grade_level: string | null };
  students: StudentDetail[];
  onChange: (s: StudentDetail[]) => void;
  onRemove: () => void;
}) {
  const addStudent = () => {
    if (students.length < 5) onChange([...students, { name: '', grade: '' }]);
  };
  const removeStudent = (idx: number) => {
    onChange(students.filter((_, i) => i !== idx));
  };
  const updateStudent = (idx: number, field: 'name' | 'grade', value: string) => {
    const updated = students.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onChange(updated);
  };

  // Auto-add one student if empty
  useEffect(() => {
    if (students.length === 0) onChange([{ name: '', grade: '' }]);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{item.name}</CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">₹{item.fee?.toLocaleString() || '0'}</Badge>
            <Button variant="ghost" size="icon" onClick={onRemove} className="text-muted-foreground hover:text-destructive h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {students.map((s, idx) => (
          <div key={idx} className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">Student {idx + 1} Name *</Label>
              <Input placeholder="Full name" value={s.name} onChange={e => updateStudent(idx, 'name', e.target.value)} />
            </div>
            <div className="w-32">
              <Label className="text-xs">Grade/Age *</Label>
              <Input placeholder="e.g. Grade 3" value={s.grade} onChange={e => updateStudent(idx, 'grade', e.target.value)} />
            </div>
            {students.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeStudent(idx)} className="h-10 w-10 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
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
            {students.length >= 3 ? '10%' : '5%'} multi-student discount applied!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DiscountSummaryStep({
  items, studentDetails, disc, couponCode, setCouponCode, couponDiscount, couponApplied, handleApplyCoupon, finalAmount,
}: {
  items: { id: string; name: string; fee: number }[];
  studentDetails: Record<string, StudentDetail[]>;
  disc: ReturnType<typeof calculateDiscounts>;
  couponCode: string;
  setCouponCode: (v: string) => void;
  couponDiscount: number;
  couponApplied: boolean;
  handleApplyCoupon: () => void;
  finalAmount: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
      <div className="text-center mb-6">
        <Tag className="mx-auto h-10 w-10 text-primary mb-2" />
        <h2 className="text-2xl font-bold text-foreground">Order Summary</h2>
        <p className="text-muted-foreground">Review your enrollment details and discounts</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Items */}
          {items.map(item => {
            const students = studentDetails[item.id] || [];
            return (
              <div key={item.id} className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{students.length} student{students.length !== 1 ? 's' : ''}: {students.map(s => s.name).join(', ')}</p>
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
                <span>Multi-course discount ({items.length >= 3 ? '10%' : '5%'})</span>
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
                onChange={e => setCouponCode(e.target.value)}
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

function PaymentStep({ finalAmount, submitting, onPay }: { finalAmount: number; submitting: boolean; onPay: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col items-center py-12">
      <CreditCard className="h-16 w-16 text-primary mb-6" />
      <h2 className="text-2xl font-bold text-foreground mb-2">Complete Payment</h2>
      <p className="text-muted-foreground mb-2">Amount to pay</p>
      <p className="text-4xl font-bold text-foreground mb-8">₹{Math.round(finalAmount).toLocaleString()}</p>
      <Button size="lg" onClick={onPay} disabled={submitting} className="min-w-[200px]">
        {submitting ? 'Processing...' : `Pay ₹${Math.round(finalAmount).toLocaleString()}`}
      </Button>
      <p className="text-xs text-muted-foreground mt-4">Secured by Cashfree Payment Gateway</p>
    </motion.div>
  );
}

/* ─── Helpers ──────────────────────────────────── */

function loadCashfreeSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Cashfree) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.head.appendChild(script);
  });
}
