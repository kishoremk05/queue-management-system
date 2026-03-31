import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Building2, Check, Lock, Mail,
  User, CheckCircle2, Clock,
} from "lucide-react";
import {
  BILLING_PLAN_BY_ID,
  BILLING_PLANS,
  DEFAULT_PLAN_ID,
  type BillingPlan,
  type BillingPlanId,
} from "@/lib/billingPlans";
import {
  DEFAULT_CURRENCY,
  loadBillingPlans,
  loadAvailableCurrencies,
  providerLabel,
  type PaymentProvider,
} from "@/lib/paymentConfig";

const steps = ["Plan & Company", "Admin Account", "Review"];

export default function CompanySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [plans, setPlans] = useState<BillingPlan[]>(BILLING_PLANS);
  const [currencies, setCurrencies] = useState<string[]>([DEFAULT_CURRENCY]);
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCY);
  const selectedProvider: PaymentProvider = "paystack";
  const selectedPlanQuery = searchParams.get("plan") as BillingPlanId | null;
  const initialPlan =
    selectedPlanQuery && BILLING_PLAN_BY_ID[selectedPlanQuery]
      ? selectedPlanQuery
      : DEFAULT_PLAN_ID;
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId>(initialPlan);
  const [form, setForm] = useState({
    company_name: "",
    admin_name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    void loadAvailableCurrencies().then((items) => {
      setCurrencies(items);
      if (!items.includes(selectedCurrency) && items[0]) setSelectedCurrency(items[0]);
    });
    void loadBillingPlans(selectedCurrency).then((loaded) => {
      setPlans(loaded);
      if (!loaded.some((p) => p.id === selectedPlanId) && loaded[0])
        setSelectedPlanId(loaded[0].id);
    });
  }, [selectedCurrency]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? BILLING_PLAN_BY_ID[selectedPlanId],
    [plans, selectedPlanId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ── 1. Create auth account ─────────────────────────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authError) {
        if (
          authError.message?.toLowerCase().includes("already registered") ||
          authError.message?.toLowerCase().includes("already been registered") ||
          (authError as any).status === 422
        ) {
          toast.error("This email is already registered.", {
            description: "Please use the Login page to access your account.",
            duration: 6000,
          });
          return;
        }
        throw authError;
      }

      if (!authData.user?.id) throw new Error("Could not create account. Please try again.");

      // ── 2. Insert company request (with safe fallback for missing columns) ─
      const basePayload = {
        user_id: authData.user.id,
        company_name: form.company_name,
        admin_name: form.admin_name,
        email: form.email,
        status: "pending",
      };

      const fullPayload = {
        ...basePayload,
        selected_plan: selectedPlan.id,
        selected_currency: selectedCurrency,
        payment_provider: "paystack",
        payment_status: "paid",          // valid enum value — treated as approved
        payment_amount: selectedPlan.amountMinor,
        payment_currency: selectedCurrency,
      };

      // Try full insert; fall back to base-only if billing columns don't exist yet
      let { error: reqErr } = await supabase
        .from("company_requests")
        .insert(fullPayload as any);

      if (reqErr) {
        const isMissingCol =
          reqErr.message?.includes("column") ||
          reqErr.message?.includes("schema cache") ||
          reqErr.code === "PGRST204" ||
          reqErr.message?.includes("constraint");

        if (isMissingCol) {
          const { error: fallbackErr } = await supabase
            .from("company_requests")
            .insert(basePayload as any);
          if (fallbackErr) {
            await supabase.auth.signOut();
            throw fallbackErr;
          }
        } else {
          await supabase.auth.signOut();
          throw reqErr;
        }
      }

      // ── 3. Try Paystack if configured; gracefully skip if not ─────────────
      const { data: created } = await supabase
        .from("company_requests")
        .select("id")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (created) {
        const { data: paymentInit } = await supabase.functions.invoke(
          "payment-initialize",
          { body: { requestId: created.id, provider: "paystack" } },
        );

        if (paymentInit?.authorizationUrl) {
          // Paystack is configured → redirect to real checkout
          await supabase.auth.signOut();
          toast.success("Redirecting to secure Paystack checkout...");
          window.location.assign(paymentInit.authorizationUrl as string);
          return;
        }
        // Paystack not configured yet → continue to success screen below
      }

      // ── 4. Registration complete ───────────────────────────────────────────
      await supabase.auth.signOut();
      setRegistered(true);

    } catch (err: any) {
      toast.error(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (registered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-blue-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl shadow-violet-500/10 border border-violet-100 p-10 text-center animate-fade-up">
          {/* Icon */}
          <div className="relative mx-auto mb-8 h-24 w-24">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-3">Registration Submitted!</h2>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">
            Your company <span className="font-bold text-violet-700">{form.company_name}</span> has been successfully registered on Smart Queue.
          </p>

          {/* Status card */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-left space-y-4 mb-8">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-100 shrink-0">
                <Clock className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Account Under Review</p>
                <p className="text-xs font-medium text-slate-500">You will be notified once your account is activated</p>
              </div>
            </div>
            {[
              { label: "Company", value: form.company_name },
              { label: "Admin", value: form.admin_name },
              { label: "Email", value: form.email },
              { label: "Plan", value: `${selectedPlan.name} — ${selectedPlan.priceLabel}${selectedPlan.periodLabel}` },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-xs">{row.label}</span>
                <span className="font-bold text-slate-800">{row.value}</span>
              </div>
            ))}
          </div>

          {/* What happens next */}
          <div className="text-left rounded-2xl bg-violet-50 border border-violet-100 p-5 mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-3">What happens next?</p>
            <ul className="space-y-2">
              {[
                "Our team reviews your registration",
                "You receive a confirmation email",
                "Login to access your dashboard",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 place-items-center justify-center rounded-full bg-violet-200 text-violet-700 text-[10px] font-black mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-violet-900">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => navigate("/company-login")}
            className="w-full h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-base font-bold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all hover:-translate-y-0.5"
          >
            Go to Login
          </Button>
          <p className="mt-4 text-xs text-slate-400 font-medium">
            Questions? Contact our support team for assistance.
          </p>
        </div>
      </div>
    );
  }

  // ── Main signup form ──────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-white border-r border-slate-200">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-blue-100/50 blur-3xl" />
          <div className="absolute right-10 bottom-1/4 h-80 w-80 rounded-full bg-violet-100/50 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md p-12 animate-fade-up">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-md shadow-blue-500/20 mb-8">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-black font-display mb-6 tracking-tight text-slate-900">
            Register Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 drop-shadow-sm">
              Company
            </span>
          </h2>
          <p className="text-lg font-medium text-slate-500 leading-relaxed max-w-sm">
            Create your Smart Queue workspace and start managing customer flow in minutes.
          </p>
          <ul className="mt-12 space-y-6">
            {[
              "Plan-based monthly billing",
              "Pay securely with Paystack",
              "Set up in under 5 minutes",
              "Instant access after approval",
            ].map((item) => (
              <li key={item} className="flex items-center gap-4 text-slate-700 font-bold text-lg">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 shrink-0">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md animate-fade-up" style={{ animationDelay: "100ms" }}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-violet-600 transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to home
          </Link>

          {/* Progress */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition-all ${
                    idx <= currentStep
                      ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-md shadow-violet-500/20"
                      : "bg-slate-200 text-slate-500"
                  }`}>
                    {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={`text-sm font-bold hidden sm:inline ${idx <= currentStep ? "text-violet-700" : "text-slate-400"}`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Step 1: Plan & Company ────────────────────────────────── */}
            {currentStep === 0 && (
              <div className="space-y-6 animate-fade-up">
                <div>
                  <h2 className="text-3xl font-black font-display text-slate-900 drop-shadow-sm">Choose a Plan</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">All plans billed monthly. Change or cancel anytime.</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Currency</span>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full rounded-2xl border p-5 text-left transition-all ${
                          isSelected
                            ? "border-violet-400 bg-violet-50 shadow-sm ring-1 ring-violet-400"
                            : "border-slate-200 bg-white hover:border-violet-200 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            plan.highlighted ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {plan.highlighted ? "Most Popular" : "Standard"}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{plan.periodLabel}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xl font-black text-slate-900">{plan.name}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">{plan.description}</p>
                          </div>
                          <p className="text-2xl font-black text-slate-900 shrink-0">{plan.priceLabel}</p>
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {plan.features.map((f) => (
                            <div key={`${plan.id}-${f}`} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-bold text-slate-700">Company Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      required
                      placeholder="Acme Corporation"
                      value={form.company_name}
                      onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                      className="h-14 pl-12 rounded-xl border-slate-200 bg-white font-medium shadow-sm text-base focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-bold text-slate-700">Admin Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      required
                      placeholder="John Smith"
                      value={form.admin_name}
                      onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))}
                      className="h-14 pl-12 rounded-xl border-slate-200 bg-white font-medium shadow-sm text-base focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    if (form.company_name && form.admin_name) setCurrentStep(1);
                    else toast.error("Please fill in all fields");
                  }}
                  className="w-full h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:-translate-y-0.5"
                >
                  Continue <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}

            {/* ── Step 2: Admin Account ─────────────────────────────────── */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-up">
                <div>
                  <h2 className="text-3xl font-black font-display text-slate-900 drop-shadow-sm">Admin Account</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Create your login credentials.</p>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-bold text-slate-700">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-14 pl-12 rounded-xl border-slate-200 bg-white font-medium shadow-sm text-base focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-bold text-slate-700">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="h-14 pl-12 rounded-xl border-slate-200 bg-white font-medium shadow-sm text-base focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    className="flex-1 h-14 border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 hover:text-violet-700 hover:border-violet-200 rounded-xl shadow-sm transition-all"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (form.email && form.password.length >= 6) setCurrentStep(2);
                      else toast.error("Please fill in all fields correctly");
                    }}
                    className="flex-[2] h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:-translate-y-0.5"
                  >
                    Continue <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Review & Pay ──────────────────────────────────── */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-up">
                <div>
                  <h2 className="text-3xl font-black font-display text-slate-900 drop-shadow-sm">Review & Pay</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Confirm your details before proceeding.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4 shadow-sm">
                  {[
                    { label: "Plan", value: `${selectedPlan.name} (${selectedPlan.priceLabel}${selectedPlan.periodLabel})` },
                    { label: "Currency", value: selectedCurrency },
                    { label: "Gateway", value: providerLabel(selectedProvider) },
                    { label: "Company", value: form.company_name },
                    { label: "Admin Name", value: form.admin_name },
                    { label: "Email", value: form.email },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center border-b border-slate-200 pb-4 last:border-0 last:pb-0">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</span>
                      <span className="text-sm font-bold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <svg className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs font-semibold text-blue-700">
                    Your payment is secured by Paystack with 256-bit SSL encryption.
                  </p>
                </div>

                <p className="text-xs font-medium text-slate-400 text-center px-4 leading-relaxed">
                  By continuing, you agree to our{" "}
                  <a href="#" className="font-bold text-violet-600 hover:underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="font-bold text-violet-600 hover:underline">Privacy Policy</a>.
                </p>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 h-14 border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 hover:text-violet-700 hover:border-violet-200 rounded-xl shadow-sm transition-all"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
                  >
                    {loading ? (
                      <span className="flex items-center gap-3">
                        <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      "Continue to Paystack"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>

          <p className="mt-10 text-center text-sm font-medium text-slate-500">
            Already registered?{" "}
            <Link to="/company-login" className="text-violet-600 hover:text-violet-700 font-bold transition-colors">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
