import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Globe,
  LayoutDashboard,
  MonitorSmartphone,
  Printer,
  QrCode,
  ScanLine,
  Shield,
  Smartphone,
  Star,
  TimerReset,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BILLING_PLANS, type BillingPlan } from "@/lib/billingPlans";
import { DEFAULT_CURRENCY, loadAvailableCurrencies, loadBillingPlans } from "@/lib/paymentConfig";
import { supabase } from "@/integrations/supabase/client";

/* ───────── Icon Lookup ───────── */
const iconMap: Record<string, any> = {
  ScanLine,
  MonitorSmartphone,
  LayoutDashboard,
  BarChart3,
  QrCode,
  Volume2,
  Printer,
  Bell,
  Zap,
  Building2,
  Cloud,
  Shield,
  Globe,
  TimerReset,
  Users,
};

const gradientMap: Record<string, { gradient: string; iconColor: string }> = {
  ScanLine: { gradient: "from-blue-100 to-cyan-50", iconColor: "text-blue-600" },
  MonitorSmartphone: { gradient: "from-violet-100 to-purple-50", iconColor: "text-violet-600" },
  LayoutDashboard: { gradient: "from-emerald-100 to-teal-50", iconColor: "text-emerald-600" },
  BarChart3: { gradient: "from-amber-100 to-orange-50", iconColor: "text-amber-600" },
  QrCode: { gradient: "from-pink-100 to-rose-50", iconColor: "text-pink-600" },
  Volume2: { gradient: "from-cyan-100 to-sky-50", iconColor: "text-cyan-600" },
  Printer: { gradient: "from-lime-100 to-green-50", iconColor: "text-lime-600" },
  Bell: { gradient: "from-indigo-100 to-violet-50", iconColor: "text-indigo-600" },
  Zap: { gradient: "from-red-100 to-pink-50", iconColor: "text-red-600" },
};

const stepColors = [
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
];

const stepIcons = [ScanLine, TimerReset, Users, MonitorSmartphone];

/* ───────── Default Data (Fallbacks) ───────── */

const defaultNavLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Screens", href: "#screens" },
  { label: "Pricing", href: "#pricing" },
];

const defaultHeroStats = [
  { value: "47%", label: "Faster Service" },
  { value: "99.9%", label: "Uptime" },
  { value: "10K+", label: "Tokens / Day" },
];

const defaultFeatureCards = [
  { title: "Self-Service Kiosk", description: "Touchscreen interface for instant service selection and token generation with thermal printing.", icon: "ScanLine" },
  { title: "Live Queue Display", description: "Real-time display boards with audio announcements and multi-counter support.", icon: "MonitorSmartphone" },
  { title: "Staff Dashboard", description: "Call, recall, skip, transfer tokens. Full queue control from an intuitive panel.", icon: "LayoutDashboard" },
  { title: "Analytics & Reports", description: "Track peak hours, waiting times, and service trends with exportable reports.", icon: "BarChart3" },
  { title: "Mobile Queue via QR", description: "Customers scan QR to join queue remotely and track position from their phone.", icon: "QrCode" },
  { title: "Audio Announcements", description: "Text-to-speech system announces token numbers and counter assignments automatically.", icon: "Volume2" },
  { title: "Thermal Ticket Printing", description: "Print queue tickets with token, QR code, service info and estimated wait time.", icon: "Printer" },
  { title: "Smart Notifications", description: "In-app reminders and display alerts as a customer's turn approaches.", icon: "Bell" },
  { title: "Priority Queuing", description: "VIP, elderly, and urgent case prioritization with intelligent queue ordering.", icon: "Zap" },
];

const defaultHowItWorksSteps = [
  { step: "01", title: "Customer selects service", description: "Visitors choose the required service at a self-service kiosk in seconds." },
  { step: "02", title: "Token is generated", description: "A smart digital token is generated instantly with queue priority rules." },
  { step: "03", title: "Staff calls customer", description: "Staff dashboard shows the next token and allows quick customer calling." },
  { step: "04", title: "Display updates live", description: "Queue display screens update in real-time for transparent waiting." },
];

const defaultTestimonials = [
  { quote: "Smart Queue reduced our average wait times by 52%. Customers love the transparency of knowing exactly where they are in the queue.", author: "Sarah Mitchell", role: "Operations Manager, City Hospital", rating: 5 },
  { quote: "The kiosk interface is incredibly intuitive. Our elderly customers can use it without any assistance, and the priority queue is a game changer.", author: "James Rodriguez", role: "Branch Manager, Metro Bank", rating: 5 },
  { quote: "Setting up was painless. Within an hour, we had our entire service center running on Smart Queue with real-time displays on every floor.", author: "Priya Sharma", role: "COO, TechServ Solutions", rating: 5 },
];

const defaultSaasFeatures = [
  { title: "Multi-Tenant Architecture", text: "Securely manage multiple organizations from one platform." },
  { title: "Cloud Infrastructure", text: "99.9% uptime with global CDN and automatic scaling." },
  { title: "Enterprise Security", text: "SOC 2 compliant with role-based access control." },
  { title: "Global Deployment", text: "Deploy kiosks and displays across unlimited branches." },
];

const saasIconMap = [Building2, Cloud, Shield, Globe];

const screenPreviews = [
  { title: "Kiosk Interface", subtitle: "Touch-friendly service selection with priority options", gradient: "from-blue-500 to-violet-500", emoji: "🖥️" },
  { title: "Staff Dashboard", subtitle: "Real-time queue management with call, skip & transfer", gradient: "from-violet-500 to-pink-500", emoji: "👨‍💼" },
  { title: "Live Display Board", subtitle: "Full-screen display with audio announcements", gradient: "from-emerald-500 to-teal-500", emoji: "📺" },
  { title: "Mobile Tracker", subtitle: "Track queue position on your phone via QR code", gradient: "from-amber-500 to-orange-500", emoji: "📱" },
];

/* ───────── Helpers ───────── */

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ───────── Component ───────── */

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [pricingPlans, setPricingPlans] = useState<BillingPlan[]>(BILLING_PLANS);
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCY);
  const [currencies, setCurrencies] = useState<string[]>([DEFAULT_CURRENCY]);

  /* ── CMS Content State ── */
  const [cms, setCms] = useState<Record<string, string>>({});

  // Derived from CMS with fallbacks
  const brandName = cms.brand_name || "Smart Queue";
  const brandTagline = cms.brand_tagline || "Queue Management SaaS";
  const brandLetter = cms.brand_letter || "Q";

  const heroTitle = cms.hero_title || "Eliminate Waiting Lines with Smart Queue Management";
  const heroSubtitle = cms.hero_subtitle || "Transform customer flow using self-service kiosks, live display boards, and powerful staff dashboards. Deliver a seamless digital queue experience that customers love.";
  const heroBadge = cms.hero_badge || "Built for modern service centers";
  const heroCtaPrimary = cms.hero_cta_primary || "Start Free Trial";
  const heroCtaSecondary = cms.hero_cta_secondary || "Request Demo";

  const heroStats = [
    { value: cms.hero_stat_1_value || "47%", label: cms.hero_stat_1_label || "Faster Service" },
    { value: cms.hero_stat_2_value || "99.9%", label: cms.hero_stat_2_label || "Uptime" },
    { value: cms.hero_stat_3_value || "10K+", label: cms.hero_stat_3_label || "Tokens / Day" },
  ];

  const featuresTitle = cms.features_title || "Everything You Need to Manage Queues";
  const featuresSubtitle = cms.features_subtitle || "From self-service kiosks to real-time analytics — a complete toolkit for modern queue management.";
  const featureCards = safeJsonParse(cms.features_list || "", defaultFeatureCards);

  const howItWorksTitle = cms.how_it_works_title || "How It Works";
  const howItWorksSubtitle = cms.how_it_works_subtitle || "Simple 4-step process from arrival to service completion.";
  const howItWorksSteps = safeJsonParse(cms.how_it_works_steps || "", defaultHowItWorksSteps);

  const testimonialsTitle = cms.testimonials_title || "Loved by Teams Everywhere";
  const testimonials = safeJsonParse(cms.testimonials_list || "", defaultTestimonials);

  const trustedByLabel = cms.trusted_by_label || "Trusted by service centers worldwide";
  const trustedByList = safeJsonParse<string[]>(cms.trusted_by_list || "", ["🏥 Hospitals", "🏦 Banks", "🏛️ Government", "📡 Telecom", "🛫 Airlines", "🎓 Universities"]);

  const pricingTitle = cms.pricing_title || "Plans That Scale With You";
  const pricingSubtitle = cms.pricing_subtitle || "Transparent monthly pricing built for serious operations.";
  const pricingBadges = safeJsonParse<string[]>(cms.pricing_badges || "", ["No hidden fees", "Cancel anytime", "Instant activation after approval"]);

  const saasTitle = cms.saas_title || "Enterprise-Ready Cloud Platform";
  const saasSubtitle = cms.saas_subtitle || "Built for scale with multi-tenant architecture, automatic backups, and global deployment capability. Designed for reliability and security.";
  const saasFeatures = safeJsonParse(cms.saas_features || "", defaultSaasFeatures);

  const ctaTitle = cms.cta_title || "Ready to Transform Your Customer Experience?";
  const ctaSubtitle = cms.cta_subtitle || "Join thousands of service centers already using Smart Queue. Start your free 14-day trial today.";
  const ctaPrimary = cms.cta_primary || "Start Free Trial";
  const ctaSecondary = cms.cta_secondary || "Contact Sales";

  const footerDescription = cms.footer_description || "The modern queue management platform for customer-centric businesses.";
  const footerCopyright = cms.footer_copyright || "Smart Queue. All rights reserved.";

  /* ── Load CMS content ── */
  useEffect(() => {
    const loadContent = async () => {
      const { data } = await supabase
        .from("site_content")
        .select("id, value");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row) => {
          map[row.id] = row.value;
        });
        setCms(map);
      }
    };
    void loadContent();
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  useEffect(() => {
    void loadAvailableCurrencies().then((items) => {
      setCurrencies(items);
      if (!items.includes(selectedCurrency) && items[0]) {
        setSelectedCurrency(items[0]);
      }
    });
  }, []);

  useEffect(() => {
    void loadBillingPlans(selectedCurrency).then((plans) => setPricingPlans(plans));
  }, [selectedCurrency]);

  // Split hero title into parts for gradient word
  const heroTitleParts = heroTitle.split(brandName);
  const hasGradientWord = heroTitleParts.length > 1;

  return (
    <div className="saas-clean min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 font-sans selection:bg-violet-200 selection:text-violet-900">
      {/* ─── Ambient Background ─── */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="liquid-orb absolute inset-x-0 top-0 h-[620px] bg-gradient-to-br from-violet-100/60 via-blue-100/40 to-transparent blur-3xl" />
        <div className="liquid-orb absolute -left-32 top-80 h-96 w-96 rounded-full bg-gradient-to-br from-violet-100/40 to-indigo-100/30 blur-3xl" />
        <div className="liquid-orb absolute right-0 top-[28rem] h-80 w-80 rounded-full bg-gradient-to-br from-blue-100/30 to-cyan-100/20 blur-3xl" />
        <div className="liquid-orb absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-100/22 to-sky-100/18 blur-3xl" />
      </div>

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 backdrop-blur-2xl shadow-[0_10px_30px_-26px_rgba(15,23,42,0.45)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/30 transition-transform duration-300 group-hover:scale-105">
              <span className="text-lg font-bold text-white">{brandLetter}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{brandName}</p>
              <p className="text-[11px] font-medium text-slate-500">{brandTagline}</p>
            </div>
          </Link>

          <nav className="liquid-chip hidden items-center gap-1 rounded-full px-2 py-1 lg:flex transition-all duration-500 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.12)]">
            {defaultNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="glass-nav-link rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white/90 hover:text-violet-700 hover:shadow-md"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Button asChild variant="ghost" className="font-semibold text-slate-600 hover:bg-slate-100 hover:text-violet-700 rounded-xl">
              <Link to="/company-login">Login</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:scale-[1.02]">
              <Link to="/company-signup">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="liquid-chip relative z-50 flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
          >
            <div className="flex flex-col gap-1.5">
              <span className={`block h-0.5 w-5 bg-slate-600 transition-all ${mobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-5 bg-slate-600 transition-all ${mobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-5 bg-slate-600 transition-all ${mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="absolute inset-x-0 top-full border-b border-white/45 bg-white/70 backdrop-blur-2xl p-6 lg:hidden animate-slide-down shadow-xl">
            <nav className="flex flex-col gap-2">
              {defaultNavLinks.map((link) => (
                <a key={link.href} href={link.href} className="rounded-xl px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 hover:text-violet-700" onClick={() => setMobileMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-3">
                <Button asChild variant="outline" className="border-slate-200 bg-white/70 text-slate-700 font-bold h-12 rounded-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5">
                  <Link to="/company-login">Login</Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold h-12 rounded-xl shadow-md transition-all duration-300 hover:-translate-y-0.5">
                  <Link to="/company-signup">Get Started</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-24 lg:px-10">
        {/* ─── Hero ─── */}
        <section className="relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2 lg:py-28">
          <div className="space-y-8 animate-fade-up">
            <div className="liquid-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-violet-700">
              <Zap className="h-4 w-4 text-amber-500" />
              {heroBadge}
            </div>

            <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[4rem] font-display">
              {hasGradientWord ? (
                <>
                  {heroTitleParts[0]}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">{brandName}</span>
                  {heroTitleParts[1]}
                </>
              ) : (
                <>
                  Eliminate Waiting Lines with{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">{brandName}</span>{" "}
                  Management
                </>
              )}
            </h1>

            <p className="max-w-xl text-lg md:text-xl font-medium leading-relaxed text-slate-500">
              {heroSubtitle}
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="h-14 bg-gradient-to-r from-violet-600 to-blue-600 px-8 text-base font-bold text-white shadow-xl shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:-translate-y-0.5"
              >
                <Link to="/company-signup">
                  {heroCtaPrimary}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 border-slate-200 bg-white px-8 text-base font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-violet-700 hover:border-violet-200 transition-all"
              >
                <Link to="/company-login">{heroCtaSecondary}</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-8 pt-6 border-t border-white/70">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-black text-slate-900 tracking-tight font-display drop-shadow-sm">{stat.value}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: "200ms" }}>
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-violet-100/90 via-blue-100/70 to-cyan-100/70 blur-3xl opacity-70" />
            <div className="liquid-panel relative overflow-hidden rounded-3xl p-2">
              <div className="rounded-[1.25rem] border border-white/70 bg-white/65 p-6 backdrop-blur-2xl">
                {/* Mock dashboard */}
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded-full bg-red-400 border border-red-500/20 shadow-sm" />
                    <div className="h-3.5 w-3.5 rounded-full bg-amber-400 border border-amber-500/20 shadow-sm" />
                    <div className="h-3.5 w-3.5 rounded-full bg-emerald-400 border border-emerald-500/20 shadow-sm" />
                  </div>
                  <div className="rounded-lg border border-white/70 bg-white/80 px-4 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur-sm">
                    dashboard.smartqueue.io
                  </div>
                  <div className="w-16" />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: "Tokens Today", value: "247", color: "text-violet-600" },
                    { label: "Avg Wait", value: "4:32", color: "text-emerald-600" },
                    { label: "Satisfaction", value: "98%", color: "text-blue-600" },
                  ].map((item) => (
                    <div key={item.label} className="liquid-panel rounded-2xl p-4 text-center">
                      <p className={`text-2xl font-black font-display tracking-tight drop-shadow-sm ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="liquid-panel hover-jitter-soft rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/60 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">NOW SERVING</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-bold text-emerald-700 shadow-sm">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Live
                    </span>
                  </div>
                  <p className="text-6xl font-black text-slate-900 tracking-tighter font-display mb-1 drop-shadow-sm relative z-10">A017</p>
                  <p className="text-sm font-medium text-slate-500 relative z-10">Counter 3 <span className="mx-2 text-slate-200">•</span> General Enquiry</p>
                </div>

                <div className="mt-4 flex gap-3">
                  {["B005", "C012", "A018"].map((token) => (
                    <div key={token} className="liquid-panel flex-1 rounded-2xl py-3 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Waiting</p>
                      <p className="font-display text-lg font-black text-slate-700">{token}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Trusted By ─── */}
        <section className="py-12 border-y border-white/65" data-reveal>
          <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-400 mb-8">
            {trustedByLabel}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {trustedByList.map((name) => (
              <span key={name} className="liquid-chip text-sm font-bold text-slate-600 px-4 py-2 rounded-full">{name}</span>
            ))}
          </div>
        </section>

        {/* ─── Features ─── */}
        <section id="features" data-reveal className="reveal-up py-24">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-bold text-violet-700 shadow-sm mb-4">
              <Zap className="h-4 w-4 text-amber-500" />
              Powerful Features
            </span>
            <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display">
              {featuresTitle.includes("Manage Queues") ? (
                <>
                  Everything You Need to{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">Manage Queues</span>
                </>
              ) : (
                featuresTitle
              )}
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-lg font-medium text-slate-500">
              {featuresSubtitle}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature: any, idx: number) => {
              const FeatureIcon = iconMap[feature.icon] || Zap;
              const colors = gradientMap[feature.icon] || { gradient: "from-slate-100 to-slate-50", iconColor: "text-slate-600" };
              return (
                <article
                  key={feature.title}
                  className="liquid-panel group relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10"
                  style={{ animationDelay: `${idx * 60}ms` } as CSSProperties}
                >
                  <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} transition-transform group-hover:scale-110 shadow-sm mb-6`}>
                    <FeatureIcon className={`h-6 w-6 ${colors.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-500">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ─── How It Works ─── */}
        <section id="how-it-works" data-reveal className="reveal-up liquid-panel py-24 -mx-6 px-6 lg:-mx-10 lg:px-10 rounded-3xl my-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display">
              {howItWorksTitle.includes("Works") ? (
                <>How It <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">Works</span></>
              ) : howItWorksTitle}
            </h2>
            <p className="mt-6 text-lg font-medium text-slate-500">
              {howItWorksSubtitle}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {howItWorksSteps.map((step: any, idx: number) => {
              const StepIcon = stepIcons[idx] || ScanLine;
              return (
                <article
                  key={step.title}
                  className="liquid-panel group relative rounded-3xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/10"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${stepColors[idx] || stepColors[0]} shadow-md`}>
                      <StepIcon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-5xl font-black text-slate-100 font-display drop-shadow-sm transition-colors group-hover:text-slate-200">{step.step}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-500">{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ─── Screens Preview ─── */}
        <section id="screens" data-reveal className="reveal-up py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display">
              Beautiful <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">Interfaces</span>
            </h2>
            <p className="mt-6 text-lg font-medium text-slate-500">
              Clean, modern interfaces designed for every user role and device.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {screenPreviews.map((screen) => (
              <div
                key={screen.title}
                className="liquid-panel group relative overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10"
              >
                <div className={`h-48 bg-gradient-to-br ${screen.gradient} flex items-center justify-center`}>
                  <span className="text-7xl opacity-90 drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{screen.emoji}</span>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-900">{screen.title}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500">{screen.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Testimonials ─── */}
        <section data-reveal className="reveal-up liquid-panel -mx-6 px-6 lg:-mx-10 lg:px-10 py-24 rounded-3xl my-10 relative overflow-hidden border border-slate-200/80">
          <div className="liquid-orb absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-violet-200/45 to-blue-200/35 rounded-full blur-3xl opacity-60 -mr-40 -mt-40 pointer-events-none" />
          <div className="liquid-orb absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-cyan-200/35 to-indigo-200/40 rounded-full blur-3xl opacity-55 -ml-40 -mb-40 pointer-events-none" />
          
          <div className="relative z-10 text-center mb-14">
            <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display drop-shadow-sm">
              {testimonialsTitle}
            </h2>
          </div>

          <div className="relative z-10 mx-auto max-w-4xl">
            {testimonials.length > 0 && (
              <>
                <div className="liquid-panel jitter-soft rounded-3xl p-10 md:p-14 text-center">
                  <div className="flex justify-center gap-1.5 mb-8">
                    {Array.from({ length: testimonials[activeTestimonial]?.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-6 w-6 fill-amber-400 text-amber-400 drop-shadow-sm" />
                    ))}
                  </div>
                  <blockquote className="text-xl md:text-2xl leading-relaxed text-slate-800 mb-10 font-medium">
                    "{testimonials[activeTestimonial]?.quote}"
                  </blockquote>
                  <div>
                    <p className="text-lg font-bold text-slate-900 drop-shadow-sm">{testimonials[activeTestimonial]?.author}</p>
                    <p className="text-base font-medium text-slate-500 mt-1">{testimonials[activeTestimonial]?.role}</p>
                  </div>
                </div>
                <div className="flex justify-center gap-3 mt-8">
                  {testimonials.map((_: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveTestimonial(idx)}
                      className={`h-2.5 rounded-full transition-all shadow-sm ${idx === activeTestimonial ? "w-10 bg-violet-600" : "w-3 bg-slate-300 hover:bg-violet-300"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ─── Pricing ─── */}
        <section id="pricing" data-reveal className="reveal-up py-24">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700 shadow-sm mb-4">
              Simple pricing
            </span>
            <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display">
              {pricingTitle.includes("Scale") ? (
                <>Plans That <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">Scale</span> With You</>
              ) : pricingTitle}
            </h2>
            <p className="mt-6 text-lg font-medium text-slate-500">
              {pricingSubtitle}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Currency</span>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {pricingBadges.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3 mx-auto max-w-6xl">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-[2rem] border p-10 transition-all duration-300 ${
                  plan.highlighted
                    ? "liquid-panel border-white/70 shadow-2xl shadow-violet-500/15 scale-[1.03] z-10"
                    : "liquid-panel border-white/70 hover:shadow-xl mt-4 mb-4"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-black text-slate-900">{plan.name}</h3>
                <p className="mt-3 text-sm font-medium text-slate-500">{plan.description}</p>
                <div className="mt-8 flex items-baseline gap-1">
                  <span className="text-5xl font-black text-slate-900 font-display tracking-tight drop-shadow-sm">{plan.priceLabel}</span>
                  <span className="text-lg font-bold text-slate-400">{plan.periodLabel}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Monthly billing
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Full onboarding support
                  </span>
                </div>
                <Button
                  asChild
                  className={`mt-8 w-full h-14 text-lg font-bold transition-all rounded-xl ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 hover:-translate-y-0.5"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-violet-200 hover:text-violet-700 shadow-sm"
                  }`}
                >
                  <Link to={`/company-signup?plan=${plan.id}`}>{plan.cta}</Link>
                </Button>
                <ul className="mt-10 space-y-4 min-h-[330px]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-4 text-base font-medium text-slate-600">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                         <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ─── SaaS Features ─── */}
        <section data-reveal className="reveal-up py-24">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display leading-[1.2]">
                {saasTitle.includes("Cloud Platform") ? (
                  <>
                    Enterprise-Ready{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 drop-shadow-sm">Cloud Platform</span>
                  </>
                ) : saasTitle}
              </h2>
              <p className="mt-6 text-lg font-medium text-slate-500 max-w-xl">
                {saasSubtitle}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {saasFeatures.map((item: any, idx: number) => {
                const SaaIcon = saasIconMap[idx] || Building2;
                return (
                  <div key={item.title} className="liquid-panel rounded-3xl p-8 transition-all hover:shadow-xl">
                    <div className="h-12 w-12 rounded-xl bg-violet-50 grid place-items-center mb-5">
                       <SaaIcon className="h-6 w-6 text-violet-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm font-medium text-slate-500">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section
          data-reveal
          className="reveal-up liquid-panel relative overflow-hidden rounded-[3rem] border border-white/70 p-12 sm:p-20 shadow-xl shadow-slate-900/10"
        >
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-violet-200/50 blur-3xl pointer-events-none" />
          <div className="absolute left-0 bottom-0 h-64 w-64 -translate-x-1/3 translate-y-1/3 rounded-full bg-blue-200/50 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col items-center text-center gap-8">
            <h2 className="text-3xl font-black text-slate-900 sm:text-5xl font-display max-w-3xl drop-shadow-sm leading-tight">
              {ctaTitle}
            </h2>
            <p className="text-xl font-medium text-slate-500 max-w-2xl">
              {ctaSubtitle}
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              <Button
                asChild
                size="lg"
                className="h-14 bg-gradient-to-r from-violet-600 to-blue-600 px-10 text-lg font-bold text-white shadow-xl shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:-translate-y-0.5"
              >
                <Link to="/company-signup">
                  {ctaPrimary}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 border-slate-200 bg-white px-10 text-lg font-bold text-slate-700 hover:bg-slate-50 hover:text-violet-700 hover:border-violet-200 shadow-sm transition-all"
              >
                <Link to="/company-login">{ctaSecondary}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/70 bg-white/60 backdrop-blur-xl mt-24">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-md shadow-violet-500/20">
                  <span className="text-xl font-black text-white">{brandLetter}</span>
                </div>
                <span className="text-xl font-bold text-slate-900">{brandName}</span>
              </div>
              <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xs">
                {footerDescription}
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 text-base tracking-wide uppercase">Product</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-500">
                <li><a href="#features" className="hover:text-violet-600 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-violet-600 transition-colors">Pricing</a></li>
                <li><a href="#screens" className="hover:text-violet-600 transition-colors">Screens</a></li>
                <li><Link to="/company-signup" className="hover:text-violet-600 transition-colors">Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 text-base tracking-wide uppercase">Company</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-500">
                <li><a href="#" className="hover:text-violet-600 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 text-base tracking-wide uppercase">Legal</h4>
              <ul className="space-y-4 text-sm font-medium text-slate-500">
                <li><a href="#" className="hover:text-violet-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-sm font-medium text-slate-500">© {new Date().getFullYear()} {footerCopyright}</p>
            <div className="flex gap-6">
              <a href="#" className="text-slate-400 hover:text-violet-600 transition-colors text-sm font-medium">Twitter</a>
              <a href="#" className="text-slate-400 hover:text-violet-600 transition-colors text-sm font-medium">LinkedIn</a>
              <a href="#" className="text-slate-400 hover:text-violet-600 transition-colors text-sm font-medium">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
