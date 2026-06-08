import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  PenTool, Play, ShoppingCart, Star, Users, BookOpen, BarChart3,
  Video, Globe, Award, ChevronRight, ChevronLeft, Check, ArrowRight, Menu, X,
  Sparkles, Zap, Shield, Clock, GraduationCap, CalendarDays,
  CreditCard, Building2, UserCheck, FileText, BrainCircuit, Layers,
  Wifi, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BatchPickerDialog } from '@/components/courses/BatchPickerDialog';
import heroVideo from '@/assets/hero-video.mp4';

type CourseDisplay = CartItem & { language: string | null; writing_style: string | null; total_hours: number | null; delivery_mode?: string; center?: string | null };

const FEATURES = [
  { icon: BrainCircuit, title: 'AI Stroke Analysis', desc: 'Real-time pressure, slant & rhythm analysis that builds personalized improvement plans.', color: 'text-purple-400' },
  { icon: Video, title: 'Live Online Classes', desc: 'Interactive sessions with expert teachers via integrated video — schedule, record & replay.', color: 'text-blue-400' },
  { icon: GraduationCap, title: 'Course & Batch Management', desc: 'Create multi-language courses, organize batches, set capacities & assign teachers.', color: 'text-emerald-400' },
  { icon: CalendarDays, title: 'Schedule & Attendance', desc: 'Weekly timetables, per-class attendance tracking with present/absent/late status.', color: 'text-amber-400' },
  { icon: CreditCard, title: 'Payments & Payroll', desc: 'Collect fees, track payment status, manage teacher payroll — all in one dashboard.', color: 'text-pink-400' },
  { icon: Building2, title: 'Multi-Organization', desc: 'Run multiple centers or franchise locations under one account with role-based access.', color: 'text-cyan-400' },
  { icon: UserCheck, title: 'Lead Management (CRM)', desc: 'Capture leads, track follow-ups, convert to enrolled students with a built-in pipeline.', color: 'text-orange-400' },
  { icon: PenTool, title: 'Custom Font Generation', desc: 'Turn any student\'s handwriting into a personal TrueType font — train characters & compile.', color: 'text-primary' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Enrollment trends, revenue reports, attendance analytics & role-based dashboards.', color: 'text-green-400' },
];

const CAPABILITY_PILLARS = [
  { icon: Layers, label: 'Academy Management', items: ['Courses & Batches', 'Schedules & Attendance', 'Materials Library', 'Multi-Organization'] },
  { icon: BrainCircuit, label: 'AI & Technology', items: ['Stroke Analysis', 'Pattern Discovery', 'Font Compilation', 'Writing Assistance'] },
  { icon: Users, label: 'People & CRM', items: ['Student Profiles', 'Lead Pipeline', 'Role-Based Access', 'Notifications'] },
  { icon: BarChart3, label: 'Finance & Reports', items: ['Fee Collection', 'Teacher Payroll', 'Revenue Analytics', 'Enrollment Trends'] },
];

const STATS = [
  { value: '10K+', label: 'Students Trained' },
  { value: '95%', label: 'Improvement Rate' },
  { value: '6+', label: 'Course Tracks' },
  { value: '50+', label: 'Expert Teachers' },
];

const TESTIMONIALS = [
  { name: 'Priya S.', role: 'Parent', text: 'My daughter\'s handwriting improved dramatically in just 3 weeks. The AI feedback is incredible!', rating: 5 },
  { name: 'Rahul M.', role: 'Student, Grade 5', text: 'I love that I can see my progress every day. The live classes are super fun!', rating: 5 },
  { name: 'Anita K.', role: 'Teacher', text: 'The best platform for teaching handwriting. The analytics help me understand each student.', rating: 5 },
];

const smoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

function AnimatedSection({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      variants={sectionVariants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.section>
  );
}

export default function LandingPage() {
  const { addItem, removeItem, isInCart, count, total, items } = useCart();
  const { session, profile } = useAuth();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [courses, setCourses] = useState<CourseDisplay[]>([]);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const courseScrollRef = useRef<HTMLDivElement>(null);

  const scrollCourses = (direction: 'left' | 'right') => {
    const container = courseScrollRef.current;
    if (!container) return;
    const scrollAmount = 360;
    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };
  const [batchPickerCourse, setBatchPickerCourse] = useState<CourseDisplay | null>(null);
  const [courseFilter, setCourseFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Parallax scroll
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const videoY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const lettersY = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    supabase.functions.invoke('public-courses').then(({ data, error }) => {
      if (!error && Array.isArray(data)) setCourses(data);
    });
  }, []);

  const toggleCart = (course: CourseDisplay) => {
    if (isInCart(course.id)) {
      removeItem(course.id);
    } else {
      // Open batch picker instead of directly adding
      setBatchPickerCourse(course);
    }
  };

  const handleBatchSelected = (batchId: string, batchName: string) => {
    if (batchPickerCourse) {
      addItem({ ...batchPickerCourse, batch_id: batchId, batch_name: batchName });
      setBatchPickerCourse(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-card/90 backdrop-blur-xl border-b border-border/50 shadow-lg' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg overflow-hidden">
              <img src="/favicon.png" alt="AuraPen" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight">AuraPen</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" onClick={e => smoothScroll(e, 'features')} className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#courses" onClick={e => smoothScroll(e, 'courses')} className="text-muted-foreground hover:text-foreground transition-colors">Courses</a>
            <a href="#testimonials" onClick={e => smoothScroll(e, 'testimonials')} className="text-muted-foreground hover:text-foreground transition-colors">Reviews</a>
            <a href="#pricing" onClick={e => smoothScroll(e, 'pricing')} className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setCartOpen(!cartOpen)} className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
            {session ? (
              <Link to="/dashboard" className="hidden sm:block">
                <Button variant="default" size="sm" className="bg-gradient-to-r from-primary to-accent">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">Log In</Button>
              </Link>
            )}
            {/* Get Started button hidden for now */}
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-card/95 backdrop-blur-xl border-b border-border/50 px-4 py-4 space-y-3 animate-fade-in">
            <a href="#features" onClick={e => { smoothScroll(e, 'features'); setMobileMenu(false); }} className="block py-2 text-muted-foreground">Features</a>
            <a href="#courses" onClick={e => { smoothScroll(e, 'courses'); setMobileMenu(false); }} className="block py-2 text-muted-foreground">Courses</a>
            <a href="#testimonials" onClick={e => { smoothScroll(e, 'testimonials'); setMobileMenu(false); }} className="block py-2 text-muted-foreground">Reviews</a>
            {session ? (
              <Link to="/dashboard" onClick={() => setMobileMenu(false)} className="block py-2 text-primary font-medium">
                Go to Dashboard{profile?.displayName ? ` (${profile.displayName})` : ''}
              </Link>
            ) : (
              <Link to="/login" onClick={() => setMobileMenu(false)} className="block py-2 text-muted-foreground">Log In</Link>
            )}
          </div>
        )}
      </nav>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border/50 shadow-2xl flex flex-col animate-slide-in">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Your Cart ({count})</h3>
              <button onClick={() => setCartOpen(false)} className="p-2 hover:bg-secondary/50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {items.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">Your cart is empty</p>
              ) : items.map(item => (
                <div key={item.id} className="flex items-start justify-between p-4 rounded-lg bg-secondary/30 border border-border/30">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.batch_name} · {item.duration_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">₹{item.fee?.toLocaleString()}</p>
                    <button onClick={() => removeItem(item.id)} className="text-xs text-destructive mt-1 hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {items.length > 0 && (
               <div className="p-6 border-t border-border/50 space-y-3">
                {(() => {
                  const subtotal = items.reduce((s, i) => s + (i.fee || 0), 0);
                  const courseCount = items.length;
                  let courseDiscountPct = 0;
                  if (courseCount >= 3) courseDiscountPct = 10;
                  else if (courseCount === 2) courseDiscountPct = 5;
                  const courseDiscount = subtotal * (courseDiscountPct / 100);
                  const discountedTotal = subtotal - courseDiscount;

                  return (
                    <>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toLocaleString()}</span>
                      </div>
                      {courseDiscountPct > 0 && (
                        <div className="flex justify-between text-sm text-primary font-medium">
                          <span>Multi-course discount ({courseDiscountPct}%)</span>
                          <span>-₹{Math.round(courseDiscount).toLocaleString()}</span>
                        </div>
                      )}
                      {courseCount >= 2 && (
                        <p className="text-xs text-primary/80 bg-primary/5 rounded-md px-3 py-2">
                          🎉 {courseCount >= 3 ? '10%' : '5%'} off for {courseCount} courses! Add more to save more.
                        </p>
                      )}
                      {courseCount === 1 && (
                        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-md px-3 py-2">
                          💡 Add another course to unlock 5% multi-course discount!
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground bg-secondary/50 rounded-md px-3 py-2">
                        👨‍👧‍👦 Enroll 2 students per course for 5% off, or 3+ for 10% off — apply at checkout!
                      </p>
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>₹{Math.round(discountedTotal).toLocaleString()}</span>
                      </div>
                    </>
                  );
                })()}
                <Button className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90" onClick={() => { setCartOpen(false); navigate('/checkout'); }}>
                  Checkout <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Video — slowest parallax layer */}
        <motion.div className="absolute inset-0" style={{ y: videoY, scale: videoScale }}>
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-40">
            <source src={heroVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
          <div className="absolute inset-0" style={{ background: 'var(--gradient-glow)' }} />
        </motion.div>

        {/* Floating letters — medium parallax layer */}
        <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ y: lettersY }}>
          {['A', 'B', 'C', 'a', 'b', 'c', 'D', 'e', 'f', 'G', 'H', 'k', 'M', 'n', 'P', 'R', 's', 'T', 'W', 'z'].map((letter, i) => {
            const colors = ['text-primary/40', 'text-accent/35', 'text-coral/30', 'text-purple-400/35', 'text-emerald-400/30', 'text-amber-400/35'];
            return (
              <motion.span
                key={i}
                className={`absolute ${colors[i % colors.length]} font-display font-bold select-none`}
                style={{
                  left: `${5 + (i * 4.8) % 90}%`,
                  bottom: '-5%',
                  fontSize: `${32 + (i % 5) * 16}px`,
                  textShadow: '0 0 20px currentColor',
                }}
                animate={{
                  y: [0, -900 - (i % 4) * 200],
                  opacity: [0, 0.7, 0.5, 0],
                  rotate: [0, (i % 2 === 0 ? 1 : -1) * (15 + (i % 3) * 10)],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (30 + (i % 5) * 15)],
                  scale: [0.8, 1.1, 0.9],
                }}
                transition={{
                  duration: 6 + (i % 4) * 2,
                  repeat: Infinity,
                  delay: i * 0.7,
                  ease: 'easeOut',
                }}
              >
                {letter}
              </motion.span>
            );
          })}
        </motion.div>

        {/* Orbiting capability icons */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {[PenTool, Video, GraduationCap, CreditCard, BarChart3, Building2].map((Icon, i) => {
            const radius = 280 + (i % 2) * 60;
            const angleOffset = (i * 60);
            const duration = 20 + i * 4;
            return (
              <motion.div
                key={i}
                className="absolute w-10 h-10 rounded-full bg-card/40 backdrop-blur-sm border border-border/30 flex items-center justify-center"
                style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.15)' }}
                animate={{
                  x: [
                    Math.cos((angleOffset * Math.PI) / 180) * radius,
                    Math.cos(((angleOffset + 120) * Math.PI) / 180) * radius,
                    Math.cos(((angleOffset + 240) * Math.PI) / 180) * radius,
                    Math.cos(((angleOffset + 360) * Math.PI) / 180) * radius,
                  ],
                  y: [
                    Math.sin((angleOffset * Math.PI) / 180) * radius,
                    Math.sin(((angleOffset + 120) * Math.PI) / 180) * radius,
                    Math.sin(((angleOffset + 240) * Math.PI) / 180) * radius,
                    Math.sin(((angleOffset + 360) * Math.PI) / 180) * radius,
                  ],
                  opacity: [0.3, 0.7, 0.5, 0.3],
                }}
                transition={{ duration, repeat: Infinity, ease: 'linear' }}
              >
                <Icon className="w-4 h-4 text-primary/60" />
              </motion.div>
            );
          })}
        </div>

        {/* Content — fastest layer (stays still / minimal shift) */}
        <motion.div className="relative container mx-auto px-4 pt-24 pb-16" style={{ y: contentY }}>
          <motion.div
            className="max-w-3xl mx-auto text-center space-y-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' as const }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Badge variant="outline" className="border-primary/40 text-primary px-4 py-1.5 text-sm">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" /> Complete Handwriting Academy Platform
              </Badge>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
              <motion.span
                className="inline-block"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                The All-in-One
              </motion.span>
              <motion.span
                className="block text-gradient"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.7, type: 'spring', stiffness: 100 }}
              >
                Handwriting SaaS
              </motion.span>
              <motion.span
                className="block text-2xl sm:text-3xl md:text-4xl font-semibold text-muted-foreground mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
              >
                {['AI Analysis', 'Live Classes', 'Academy Management'].map((text, i) => (
                  <motion.span
                    key={text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0 + i * 0.2, duration: 0.4 }}
                  >
                    {i > 0 && <span className="text-primary mx-2">·</span>}
                    {text}
                  </motion.span>
                ))}
              </motion.span>
            </h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
            >
              Run your entire handwriting academy from one platform — AI-powered stroke analysis, 
              course management, live classes, payments, CRM, multi-org support & custom font generation.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.5 }}
            >
              {/* Start Free Trial button hidden for now */}
              <a href="#courses" onClick={e => smoothScroll(e, 'courses')}>
                <Button variant="outline" size="lg" className="border-border/50 text-lg px-8 h-14 hover:border-primary/40 transition-colors">
                  <Play className="w-5 h-5 mr-2" /> Explore Courses
                </Button>
              </a>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 mt-8 border-t border-border/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.6 }}
            >
              {STATS.map((s, i) => {
                const colors = ['text-primary', 'text-accent', 'text-coral', 'text-primary'];
                return (
                  <motion.div
                    key={s.label}
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.0 + i * 0.15, duration: 0.4 }}
                  >
                    <p className={`text-3xl md:text-4xl font-bold ${colors[i]}`} style={{ textShadow: '0 0 30px currentColor' }}>{s.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      <AnimatedSection id="features" className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-accent/40 text-accent mb-4">Platform Capabilities</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Everything to Run Your <span className="text-gradient">Handwriting Academy</span></h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">From AI stroke analysis to payments & payroll — one platform, zero compromises.</p>
          </div>
          <motion.div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}>
            {FEATURES.map(f => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                whileHover={{ scale: 1.04, y: -6, boxShadow: '0 20px 50px -12px hsl(265 90% 65% / 0.2)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="group p-6 rounded-2xl bg-card/60 border border-border/40 hover:border-primary/40 gradient-border relative cursor-default"
              >
                <motion.div
                  className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4 shadow-sm shadow-primary/10"
                  whileHover={{ rotate: 8, scale: 1.1 }}
                >
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </motion.div>
                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Capability Pillars */}
          <motion.div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}>
            {CAPABILITY_PILLARS.map((p, i) => {
              const glows = ['shadow-purple-500/15', 'shadow-emerald-500/15', 'shadow-amber-500/15', 'shadow-blue-500/15'];
              return (
                <motion.div
                  key={p.label}
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/5 border border-border/40 text-center hover:border-primary/30 hover:shadow-xl ${glows[i]} cursor-default`}
                >
                  <motion.div
                    className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"
                    whileHover={{ rotate: -10, scale: 1.15 }}
                  >
                    <p.icon className="w-7 h-7 text-primary" />
                  </motion.div>
                  <h4 className="font-bold mb-3">{p.label}</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {p.items.map(item => (
                      <li key={item} className="flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-primary/70" /> {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      <AnimatedSection id="courses" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <Badge variant="outline" className="border-primary/40 text-primary mb-4" id="pricing">Courses & Pricing</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Choose Your <span className="text-gradient">Learning Path</span></h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">From beginner to calligrapher — find the perfect course.</p>
          </div>

          {/* Online / Offline filter */}
          <div className="flex justify-center gap-2 mb-10">
            {([['all', 'All Courses'], ['online', 'Online'], ['offline', 'Offline']] as const).map(([val, label]) => (
              <Button
                key={val}
                variant={courseFilter === val ? 'default' : 'outline'}
                size="sm"
                className={courseFilter === val ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground' : 'border-border/50'}
                onClick={() => setCourseFilter(val)}
              >
                {val === 'online' && <Wifi className="w-3.5 h-3.5 mr-1.5" />}
                {val === 'offline' && <Building2 className="w-3.5 h-3.5 mr-1.5" />}
                {label} ({val === 'all' ? courses.length : courses.filter(c => (c.delivery_mode || 'online') === val).length})
              </Button>
            ))}
          </div>
        </div>

        {/* Auto-scrolling course carousel */}
        {(() => {
          const filtered = courseFilter === 'all' ? courses : courses.filter(c => (c.delivery_mode || 'online') === courseFilter);
          if (filtered.length === 0) return (
            <div className="container mx-auto px-4">
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>{courses.length === 0 ? 'Loading courses...' : 'No courses in this category.'}</p>
              </div>
            </div>
          );
          return (
          <div className="relative">
            {/* Left arrow */}
            <button
              onClick={() => scrollCourses('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center text-foreground hover:bg-muted transition-colors shadow-lg"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {/* Right arrow */}
            <button
              onClick={() => scrollCourses('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border/50 flex items-center justify-center text-foreground hover:bg-muted transition-colors shadow-lg"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div
              ref={courseScrollRef}
              className="flex gap-6 px-12 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              key={courseFilter}
            >
              {filtered.map((c, idx) => {
                const inCart = isInCart(c.id);
                const isOffline = c.delivery_mode === 'offline';
                const styleColors = [
                  'from-purple-500/20 to-purple-900/5',
                  'from-emerald-500/20 to-emerald-900/5',
                  'from-amber-500/20 to-amber-900/5',
                  'from-blue-500/20 to-blue-900/5',
                  'from-pink-500/20 to-pink-900/5',
                  'from-cyan-500/20 to-cyan-900/5',
                  'from-orange-500/20 to-orange-900/5',
                  'from-indigo-500/20 to-indigo-900/5',
                  'from-rose-500/20 to-rose-900/5',
                ];
                return (
                  <motion.div
                    key={c.id}
                    className={`flex-shrink-0 w-[300px] sm:w-[340px] rounded-xl border overflow-hidden transition-all duration-300 bg-gradient-to-br snap-start ${styleColors[idx % styleColors.length]} ${inCart ? 'border-accent/60 shadow-lg shadow-accent/10' : 'border-border/40 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10'}`}
                    whileHover={{ scale: 1.03, y: -8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <Badge variant="secondary" className="text-xs">{c.language} · {c.writing_style}</Badge>
                        <Badge variant={isOffline ? 'default' : 'outline'} className="text-xs gap-1">
                          {isOffline ? <Building2 className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                          {isOffline ? 'Offline' : 'Online'}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-lg">{c.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{c.description}</p>
                      {isOffline && c.center && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" /> {c.center}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.duration_days} days</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {c.total_hours} hrs</span>
                      </div>
                      <div className="flex items-end justify-between pt-2 border-t border-border/30">
                        <div>
                          <p className="text-2xl font-bold">₹{c.fee.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">one-time</p>
                        </div>
                        <Button
                          size="sm"
                          variant={inCart ? 'outline' : 'default'}
                          className={inCart ? 'border-accent text-accent hover:bg-accent/10' : 'bg-gradient-to-r from-primary to-accent hover:opacity-90'}
                          onClick={() => toggleCart(c)}
                        >
                          {inCart ? <><Check className="w-4 h-4 mr-1" /> In Cart</> : <><ShoppingCart className="w-4 h-4 mr-1" /> Add to Cart</>}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          );
        })()}
      </AnimatedSection>

      <AnimatedSection id="testimonials" className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-warning/40 text-warning mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Loved by <span className="text-gradient">Students & Parents</span></h2>
          </div>
          <motion.div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}>
            {TESTIMONIALS.map((t, i) => {
              const borderColors = ['border-l-primary', 'border-l-accent', 'border-l-coral'];
              const glows = ['hover:shadow-purple-500/10', 'hover:shadow-emerald-500/10', 'hover:shadow-orange-500/10'];
              return (
                <motion.div
                  key={t.name}
                  variants={itemVariants}
                  whileHover={{ scale: 1.04, y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`p-6 rounded-2xl bg-card/60 border border-border/40 border-l-[3px] ${borderColors[i]} hover:border-primary/30 hover:shadow-xl ${glows[i]} cursor-default`}
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 italic">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* CTA */}
      <AnimatedSection className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            className="max-w-3xl mx-auto text-center p-12 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-card to-accent/10"
            whileHover={{ boxShadow: '0 25px 60px -15px hsl(265 90% 65% / 0.2), 0 0 80px hsl(165 80% 45% / 0.08)' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your Handwriting?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Join thousands of students improving their handwriting with AI-powered coaching.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Start Free Trial button hidden for now */}
              {count > 0 && (
                <Button size="lg" variant="outline" className="px-8 h-14" onClick={() => setCartOpen(true)}>
                  <ShoppingCart className="w-5 h-5 mr-2" /> View Cart ({count})
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg overflow-hidden">
                  <img src="/favicon.png" alt="AuraPen" className="w-full h-full object-contain" />
                </div>
                <span className="font-bold">AuraPen</span>
              </div>
              <p className="text-sm text-muted-foreground">AI-powered handwriting education for the next generation.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <a href="#features" onClick={e => smoothScroll(e, 'features')} className="block hover:text-foreground transition-colors">Features</a>
                <a href="#courses" onClick={e => smoothScroll(e, 'courses')} className="block hover:text-foreground transition-colors">Courses</a>
                <a href="#pricing" onClick={e => smoothScroll(e, 'pricing')} className="block hover:text-foreground transition-colors">Pricing</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <a href="#" className="block hover:text-foreground transition-colors">About</a>
                <a href="#" className="block hover:text-foreground transition-colors">Blog</a>
                <a href="#" className="block hover:text-foreground transition-colors">Careers</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <a href="#" className="block hover:text-foreground transition-colors">Help Center</a>
                <a href="#" className="block hover:text-foreground transition-colors">Contact</a>
                <a href="#" className="block hover:text-foreground transition-colors">Privacy</a>
              </div>
            </div>
          </div>
          <div className="border-t border-border/30 mt-8 pt-8 text-center text-xs text-muted-foreground">
            © 2026 AuraPen. All rights reserved.
          </div>
        </div>
      </footer>
      {/* Batch Picker Dialog */}
      <BatchPickerDialog
        open={!!batchPickerCourse}
        onOpenChange={(open) => { if (!open) setBatchPickerCourse(null); }}
        courseId={batchPickerCourse?.id ?? ''}
        courseName={batchPickerCourse?.name ?? ''}
        onSelect={handleBatchSelected}
      />
    </div>
  );
}
