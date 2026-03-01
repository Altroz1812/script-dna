import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PenTool, Play, ShoppingCart, Star, Users, BookOpen, BarChart3,
  Video, Globe, Award, ChevronRight, Check, ArrowRight, Menu, X,
  Sparkles, Zap, Shield, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart, CartItem } from '@/contexts/CartContext';
import heroVideo from '@/assets/hero-video.mp4';

// Static course catalog matching the DB catalog
const COURSES: (CartItem & { language: string; writing_style: string; total_hours: number })[] = [
  { id: 'c1', name: 'English Cursive Writing – Joined', description: 'Master beautiful joined cursive handwriting for daily use.', fee: 2500, grade_level: 'UKG–2nd', duration_days: 30, language: 'English', writing_style: 'Cursive (Joined)', total_hours: 20 },
  { id: 'c2', name: 'English Cursive Writing – Split', description: 'Learn clean, readable print-style handwriting.', fee: 2500, grade_level: 'UKG–2nd', duration_days: 30, language: 'English', writing_style: 'Print (Split)', total_hours: 20 },
  { id: 'c3', name: 'Advanced English Cursive', description: 'Elevate your cursive with speed, flow, and consistency.', fee: 3500, grade_level: '3rd+', duration_days: 60, language: 'English', writing_style: 'Cursive (Joined)', total_hours: 45 },
  { id: 'c4', name: 'Hindi Handwriting Mastery', description: 'Perfect Devanagari script with proper stroke order and spacing.', fee: 3000, grade_level: '3rd+', duration_days: 45, language: 'Hindi', writing_style: 'Devanagari', total_hours: 30 },
  { id: 'c5', name: 'Kannada Handwriting', description: 'Learn beautiful Kannada script writing with precision.', fee: 3000, grade_level: '3rd+', duration_days: 45, language: 'Kannada', writing_style: 'Kannada', total_hours: 30 },
  { id: 'c6', name: 'Calligraphy Foundations', description: 'Explore artistic calligraphy with digital and analog techniques.', fee: 4000, grade_level: '4th+', duration_days: 60, language: 'English', writing_style: 'Calligraphy', total_hours: 40 },
];

const FEATURES = [
  { icon: PenTool, title: 'AI Stroke Analysis', desc: 'Real-time pressure, slant, and rhythm analysis powered by machine learning.' },
  { icon: Video, title: 'Live Online Classes', desc: 'Interactive sessions with expert teachers via integrated video conferencing.' },
  { icon: Sparkles, title: 'Pattern Discovery', desc: 'AI discovers your unique handwriting patterns and builds custom improvement plans.' },
  { icon: BarChart3, title: 'Progress Tracking', desc: 'Detailed analytics dashboards showing improvement over time.' },
  { icon: Globe, title: 'Multi-Language Support', desc: 'Courses in English, Hindi, Kannada, and Calligraphy styles.' },
  { icon: Shield, title: 'Font Compilation', desc: 'Turn your handwriting into a personal TrueType font file.' },
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

export default function LandingPage() {
  const { addItem, removeItem, isInCart, count, total, items } = useCart();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const toggleCart = (course: typeof COURSES[0]) => {
    if (isInCart(course.id)) removeItem(course.id);
    else addItem(course);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-card/90 backdrop-blur-xl border-b border-border/50 shadow-lg' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <PenTool className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">WriteGenius</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#courses" className="text-muted-foreground hover:text-foreground transition-colors">Courses</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Reviews</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
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
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Log In</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground">
                Get Started
              </Button>
            </Link>
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-card/95 backdrop-blur-xl border-b border-border/50 px-4 py-4 space-y-3 animate-fade-in">
            <a href="#features" className="block py-2 text-muted-foreground" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#courses" className="block py-2 text-muted-foreground" onClick={() => setMobileMenu(false)}>Courses</a>
            <a href="#testimonials" className="block py-2 text-muted-foreground" onClick={() => setMobileMenu(false)}>Reviews</a>
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
                    <p className="text-xs text-muted-foreground mt-1">{item.duration_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">₹{item.fee?.toLocaleString()}</p>
                    <button onClick={() => removeItem(item.id)} className="text-xs text-destructive mt-1 hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div className="p-6 border-t border-border/50 space-y-4">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>
                <Button className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90" onClick={() => { setCartOpen(false); navigate('/signup'); }}>
                  Checkout <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30">
            <source src={heroVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          <div className="absolute inset-0" style={{ background: 'var(--gradient-glow)' }} />
        </div>

        <div className="relative container mx-auto px-4 pt-24 pb-16">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <Badge variant="outline" className="border-primary/40 text-primary px-4 py-1.5 text-sm">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI-Powered Handwriting Education
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
              Master Beautiful
              <span className="block text-gradient">Handwriting</span>
              <span className="block text-2xl sm:text-3xl md:text-4xl font-semibold text-muted-foreground mt-3">with AI & Live Classes</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The world's first AI-powered handwriting platform. Real-time stroke analysis, 
              personalized coaching, live classes, and custom font generation — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-lg px-8 h-14">
                  Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="#courses">
                <Button variant="outline" size="lg" className="border-border/50 text-lg px-8 h-14">
                  <Play className="w-5 h-5 mr-2" /> Explore Courses
                </Button>
              </a>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-12 mt-8 border-t border-border/30">
              {STATS.map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-gradient">{s.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-accent/40 text-accent mb-4">Features</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Everything You Need to <span className="text-gradient">Write Better</span></h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Combining cutting-edge AI with proven teaching methods.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-6 rounded-xl bg-card/60 border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSES / PRICING */}
      <section id="courses" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-primary/40 text-primary mb-4" id="pricing">Courses & Pricing</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Choose Your <span className="text-gradient">Learning Path</span></h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">From beginner to calligrapher — find the perfect course.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {COURSES.map(c => {
              const inCart = isInCart(c.id);
              return (
                <div key={c.id} className={`relative rounded-xl border overflow-hidden transition-all duration-300 ${inCart ? 'border-accent/60 bg-accent/5 shadow-lg shadow-accent/10' : 'border-border/40 bg-card/60 hover:border-primary/40'}`}>
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary" className="text-xs">{c.language} · {c.writing_style}</Badge>
                      <Badge variant="outline" className="text-xs">{c.grade_level}</Badge>
                    </div>
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.description}</p>
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
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="py-24 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-warning/40 text-warning mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Loved by <span className="text-gradient">Students & Parents</span></h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-6 rounded-xl bg-card/60 border border-border/40">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-card to-accent/10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Transform Your Handwriting?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Join thousands of students improving their handwriting with AI-powered coaching.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 px-8 h-14 text-lg">
                  Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              {count > 0 && (
                <Button size="lg" variant="outline" className="px-8 h-14" onClick={() => setCartOpen(true)}>
                  <ShoppingCart className="w-5 h-5 mr-2" /> View Cart ({count})
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <PenTool className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold">WriteGenius</span>
              </div>
              <p className="text-sm text-muted-foreground">AI-powered handwriting education for the next generation.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <a href="#features" className="block hover:text-foreground transition-colors">Features</a>
                <a href="#courses" className="block hover:text-foreground transition-colors">Courses</a>
                <a href="#pricing" className="block hover:text-foreground transition-colors">Pricing</a>
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
            © 2026 WriteGenius. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
