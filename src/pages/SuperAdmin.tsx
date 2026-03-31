import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  Key,
  LayoutDashboard,
  LogOut,
  Percent,
  Save,
  Search,
  Settings,
  Shield,
  TestTube,
  Trash2,
  XCircle,
  Plus,
  DollarSign,
} from "lucide-react";

/* ─── Types ─── */
interface SiteContentRow {
  id: string;
  section: string;
  label: string;
  content_type: string;
  value: string;
  sort_order: number;
}

interface PlanRow {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  period_label: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  is_active: boolean;
  sort_order: number;
}

/* ─── Component ─── */
export default function SuperAdmin() {
  const { signOut } = useAuth();

  /* ── Company Requests State ── */
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  /* ── Pricing State ── */
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [planEdits, setPlanEdits] = useState<Record<string, Partial<PlanRow>>>({});
  const [newCurrency, setNewCurrency] = useState("");
  const [savingPrices, setSavingPrices] = useState(false);

  /* ── Paystack Settings State ── */
  const [paystackPublicKey, setPaystackPublicKey] = useState("");
  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [paystackCallbackUrl, setPaystackCallbackUrl] = useState("");
  const [paystackTestMode, setPaystackTestMode] = useState(true);
  const [commissionType, setCommissionType] = useState<"percentage" | "flat">("percentage");
  const [commissionValue, setCommissionValue] = useState("2.5");
  const [commissionFlatAmount, setCommissionFlatAmount] = useState("0");
  const [showSecret, setShowSecret] = useState(false);
  const [savingPaystack, setSavingPaystack] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  /* ── CMS State ── */
  const [siteContent, setSiteContent] = useState<SiteContentRow[]>([]);
  const [cmsEdits, setCmsEdits] = useState<Record<string, string>>({});
  const [savingCms, setSavingCms] = useState(false);

  /* ═══════════════════════════════════════════
     DATA FETCHING
     ═══════════════════════════════════════════ */

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("company_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRequests(data || []);
    setLoading(false);
  };

  const fetchPricing = async () => {
    const [{ data: plansData }, { data: pricesData }] = await Promise.all([
      supabase
        .from("billing_plans")
        .select("id, name, description, amount, currency, period_label, features, cta, highlighted, is_active, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("billing_plan_prices")
        .select("plan_id, currency, amount")
        .eq("is_active", true),
    ]);

    const safePlans: PlanRow[] = (plansData || []).map((p: any) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features.filter((f: any) => typeof f === "string") : [],
    }));
    const safePrices = pricesData || [];
    const uniqueCurrencies = Array.from(new Set(safePrices.map((row) => row.currency))).sort();

    const inputs: Record<string, string> = {};
    safePrices.forEach((row) => {
      inputs[`${row.plan_id}:${row.currency}`] = (row.amount / 100).toFixed(2);
    });

    setPlans(safePlans);
    setCurrencies(uniqueCurrencies.length > 0 ? uniqueCurrencies : ["USD"]);
    setPriceInputs(inputs);
    setPlanEdits({});
  };

  const fetchPaystackSettings = async () => {
    const { data } = await supabase
      .from("platform_payment_settings")
      .select("paystack_public_key, paystack_secret_key, paystack_callback_url, paystack_test_mode, commission_type, commission_value, commission_flat_amount")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      setPaystackPublicKey(data.paystack_public_key || "");
      setPaystackSecretKey(data.paystack_secret_key || "");
      setPaystackCallbackUrl(data.paystack_callback_url || "");
      setPaystackTestMode(data.paystack_test_mode ?? true);
      setCommissionType((data.commission_type as "percentage" | "flat") || "percentage");
      setCommissionValue(String(data.commission_value ?? "2.5"));
      setCommissionFlatAmount(String(data.commission_flat_amount ?? "0"));
    }
  };

  const fetchSiteContent = async () => {
    const { data } = await supabase
      .from("site_content")
      .select("*")
      .order("section", { ascending: true })
      .order("sort_order", { ascending: true });

    if (data) {
      setSiteContent(data);
      const edits: Record<string, string> = {};
      data.forEach((row) => {
        edits[row.id] = row.value;
      });
      setCmsEdits(edits);
    }
  };

  useEffect(() => {
    fetchRequests();
    void fetchPricing();
    void fetchPaystackSettings();
    void fetchSiteContent();
  }, []);

  /* ═══════════════════════════════════════════
     COMPANY REQUESTS ACTIONS
     ═══════════════════════════════════════════ */

  const approveCompany = async (req: any) => {
    try {
      if (req.payment_status !== "paid") {
        toast.error("Payment must be completed before approval.");
        return;
      }

      const { data: orgData, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: req.company_name })
        .select()
        .single();
      if (orgErr) throw orgErr;

      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: req.user_id, role: "company_admin", organization_id: orgData.id });
      if (roleErr) throw roleErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .insert({ user_id: req.user_id, name: req.admin_name, email: req.email, organization_id: orgData.id });
      if (profErr) throw profErr;

      const periodStart = new Date();
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: subscriptionError } = await supabase
        .from("organization_subscriptions")
        .insert({
          organization_id: orgData.id,
          request_id: req.id,
          plan_id: req.selected_plan || "professional",
          status: "active",
          amount: req.payment_amount || 0,
          currency: req.payment_currency || "USD",
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          next_billing_at: periodEnd.toISOString(),
          payment_provider: req.payment_provider || "paystack",
          payment_reference: req.payment_reference || req.paystack_reference || null,
          paystack_reference: req.paystack_reference,
        });
      if (subscriptionError) throw subscriptionError;

      const { error: reqErr } = await supabase
        .from("company_requests")
        .update({ status: "approved" })
        .eq("id", req.id);
      if (reqErr) throw reqErr;

      toast.success(`${req.company_name} has been approved`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const rejectCompany = async (id: string) => {
    const { error } = await supabase
      .from("company_requests")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Company request rejected");
      fetchRequests();
    }
  };

  /* ═══════════════════════════════════════════
     PRICING ACTIONS
     ═══════════════════════════════════════════ */

  const addCurrencyColumn = () => {
    const code = newCurrency.trim().toUpperCase();
    if (!code || code.length !== 3) {
      toast.error("Use a 3-letter currency code, e.g. USD.");
      return;
    }
    if (currencies.includes(code)) {
      toast.error("Currency already exists.");
      return;
    }
    setCurrencies((prev) => [...prev, code]);
    setNewCurrency("");
  };

  const savePricing = async () => {
    if (plans.length === 0 || currencies.length === 0) {
      toast.error("No pricing data to save.");
      return;
    }

    setSavingPrices(true);
    try {
      // Save plan edits (name, description, features, cta, etc.)
      for (const plan of plans) {
        const edits = planEdits[plan.id];
        if (edits && Object.keys(edits).length > 0) {
          const updatePayload: any = { updated_at: new Date().toISOString() };
          if (edits.name !== undefined) updatePayload.name = edits.name;
          if (edits.description !== undefined) updatePayload.description = edits.description;
          if (edits.cta !== undefined) updatePayload.cta = edits.cta;
          if (edits.features !== undefined) updatePayload.features = edits.features;
          if (edits.highlighted !== undefined) updatePayload.highlighted = edits.highlighted;
          if (edits.is_active !== undefined) updatePayload.is_active = edits.is_active;

          const { error } = await supabase
            .from("billing_plans")
            .update(updatePayload)
            .eq("id", plan.id);
          if (error) throw error;
        }
      }

      // Save price rows
      const rows = plans.flatMap((plan) =>
        currencies.map((currency) => {
          const key = `${plan.id}:${currency}`;
          const value = Number.parseFloat(priceInputs[key] || "0");
          return {
            plan_id: plan.id,
            currency,
            amount: Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0,
            is_active: true,
          };
        }),
      );

      const { error } = await supabase
        .from("billing_plan_prices")
        .upsert(rows, { onConflict: "plan_id,currency" });

      if (error) throw error;

      toast.success("Pricing updated successfully.");
      await fetchPricing();
    } catch (error: any) {
      toast.error(error.message || "Failed to save pricing.");
    } finally {
      setSavingPrices(false);
    }
  };

  const updatePlanField = (planId: string, field: keyof PlanRow, value: any) => {
    setPlanEdits((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
  };

  /* ═══════════════════════════════════════════
     PAYSTACK SETTINGS ACTIONS
     ═══════════════════════════════════════════ */

  const savePaystackSettings = async () => {
    setSavingPaystack(true);
    try {
      const { error } = await supabase
        .from("platform_payment_settings")
        .update({
          paystack_public_key: paystackPublicKey.trim() || null,
          paystack_secret_key: paystackSecretKey.trim() || null,
          paystack_callback_url: paystackCallbackUrl.trim() || null,
          paystack_test_mode: paystackTestMode,
          commission_type: commissionType,
          commission_value: parseFloat(commissionValue) || 0,
          commission_flat_amount: Math.round((parseFloat(commissionFlatAmount) || 0) * 100),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;
      toast.success("Paystack settings saved successfully.");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings.");
    } finally {
      setSavingPaystack(false);
    }
  };

  const testPaystackConnection = async () => {
    const key = paystackSecretKey.trim();
    if (!key) {
      toast.error("Please enter a Paystack Secret Key first.");
      return;
    }
    setTestingConnection(true);
    try {
      // Test the key by fetching Paystack bank list (a simple read endpoint)
      const res = await fetch("https://api.paystack.co/bank?currency=USD&perPage=1", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      if (res.ok && data.status) {
        toast.success("✅ Paystack connection successful! API key is valid.");
      } else {
        toast.error(`❌ Paystack returned: ${data.message || "Invalid API key"}`);
      }
    } catch (error: any) {
      toast.error(`Connection failed: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  /* ═══════════════════════════════════════════
     CMS ACTIONS
     ═══════════════════════════════════════════ */

  const saveCmsContent = async () => {
    setSavingCms(true);
    try {
      const updates = siteContent
        .filter((row) => cmsEdits[row.id] !== row.value)
        .map((row) => ({
          id: row.id,
          section: row.section,
          label: row.label,
          content_type: row.content_type,
          value: cmsEdits[row.id] ?? row.value,
          sort_order: row.sort_order,
          updated_at: new Date().toISOString(),
        }));

      if (updates.length === 0) {
        toast.info("No changes to save.");
        setSavingCms(false);
        return;
      }

      const { error } = await supabase
        .from("site_content")
        .upsert(updates, { onConflict: "id" });

      if (error) throw error;

      toast.success(`Saved ${updates.length} content update(s).`);
      await fetchSiteContent();
    } catch (error: any) {
      toast.error(error.message || "Failed to save content.");
    } finally {
      setSavingCms(false);
    }
  };

  /* ═══════════════════════════════════════════
     DERIVED VALUES
     ═══════════════════════════════════════════ */

  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      !searchQuery ||
      req.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.admin_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || req.status === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  // Group CMS content by section
  const cmsSections = siteContent.reduce<Record<string, SiteContentRow[]>>((acc, row) => {
    if (!acc[row.section]) acc[row.section] = [];
    acc[row.section].push(row);
    return acc;
  }, {});

  const sectionLabels: Record<string, string> = {
    brand: "🏷️ Brand",
    hero: "🚀 Hero Section",
    features: "⚡ Features",
    how_it_works: "📋 How It Works",
    testimonials: "💬 Testimonials",
    trusted_by: "🤝 Trusted By",
    pricing: "💰 Pricing Section",
    saas: "☁️ SaaS Features",
    cta: "🎯 Call to Action",
    footer: "📄 Footer",
  };

  const isTestKey = paystackSecretKey.startsWith("sk_test_");
  const isLiveKey = paystackSecretKey.startsWith("sk_live_");

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-red-500 shadow-md shadow-amber-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-slate-900 leading-tight">Super Admin</h1>
              <p className="text-xs font-medium text-slate-500">Platform Management</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut} className="text-slate-600 hover:text-red-700 hover:bg-red-50 font-semibold rounded-xl">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 lg:p-8 space-y-6 lg:space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-fade-up">
          {[
            { label: "Total Companies", value: stats.total, icon: Building2, color: "text-violet-600", bg: "from-violet-100 to-violet-50" },
            { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "from-amber-100 to-amber-50" },
            { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "text-emerald-600", bg: "from-emerald-100 to-emerald-50" },
            { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "from-red-100 to-red-50" },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.bg} mb-4`}>
                  <StatIcon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <p className="text-4xl font-black text-slate-900 font-display tracking-tight">{stat.value}</p>
                <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* ═══ Tabbed Interface ═══ */}
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm flex-wrap">
            <TabsTrigger value="requests" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
              <Building2 className="h-4 w-4 mr-2" /> Requests
              {stats.pending > 0 && <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-red-100 text-red-700 text-[10px] font-black">{stats.pending}</span>}
            </TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
              <DollarSign className="h-4 w-4 mr-2" /> Pricing
            </TabsTrigger>
            <TabsTrigger value="paystack" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
              <CreditCard className="h-4 w-4 mr-2" /> Paystack
            </TabsTrigger>
            <TabsTrigger value="cms" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
              <Edit3 className="h-4 w-4 mr-2" /> Website Content
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════
              TAB 1: Company Requests
              ═══════════════════════════════════ */}
          <TabsContent value="requests" className="animate-fade-up">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <h2 className="text-2xl font-black font-display text-slate-900">Company Requests</h2>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search companies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 pl-11 w-full rounded-xl border-slate-200 bg-slate-50 text-slate-900 focus:border-violet-500 focus:ring-violet-500 font-medium"
                    />
                  </div>
                  <div className="flex w-full sm:w-auto p-1 rounded-xl border border-slate-200 bg-slate-50 overflow-x-auto no-scrollbar">
                    {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold capitalize transition-all ${
                          filter === f
                            ? "bg-white text-violet-700 shadow-sm border border-slate-200"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {f}
                        {f !== "all" && (
                          <span className="ml-1.5 text-xs opacity-70">
                            ({f === "pending" ? stats.pending : f === "approved" ? stats.approved : stats.rejected})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <span className="h-8 w-8 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map((req) => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-2xl font-black font-display text-violet-600 shrink-0">
                          {req.company_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-lg truncate">{req.company_name}</p>
                          <p className="text-sm font-medium text-slate-500 truncate">{req.admin_name} • {req.email}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                            Plan: {req.selected_plan || "professional"} • Gateway: paystack • Payment: {req.payment_status || "unpaid"}
                          </p>
                          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                            {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-4 shrink-0 mt-2 sm:mt-0">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
                            req.status === "pending"
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : req.status === "approved"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : "bg-red-100 text-red-700 border border-red-200"
                          }`}
                        >
                          {req.status === "pending" && <Clock className="h-3 w-3" />}
                          {req.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {req.status === "rejected" && <XCircle className="h-3 w-3" />}
                          {req.status}
                        </span>
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveCompany(req)}
                              disabled={req.payment_status !== "paid"}
                              className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => rejectCompany(req.id)}
                              variant="outline"
                              className="h-10 px-5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold rounded-xl shadow-sm"
                            >
                              <XCircle className="h-4 w-4 mr-2" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredRequests.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                      <div className="mx-auto h-16 w-16 bg-white rounded-full grid place-items-center mb-4 shadow-sm">
                        <Building2 className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-xl font-bold text-slate-900 mb-2">No Requests Found</p>
                      <p className="text-slate-500 font-medium max-w-sm mx-auto">
                        {searchQuery ? "Try adjusting your search terms or filters." : "New company registration requests will appear here."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════
              TAB 2: Pricing Management
              ═══════════════════════════════════ */}
          <TabsContent value="pricing" className="space-y-6 animate-fade-up">
            {/* Plan Details Editing */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-black font-display text-slate-900">Plan Details</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Edit plan names, descriptions, features, and display options.</p>
                </div>
              </div>

              <div className="space-y-6">
                {plans.map((plan) => {
                  const edits = planEdits[plan.id] || {};
                  return (
                    <div key={plan.id} className={`rounded-2xl border p-6 transition-all ${plan.is_active ? "border-slate-200 bg-white" : "border-red-200 bg-red-50/30"}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${plan.highlighted ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                            {plan.id}
                          </span>
                          {!plan.is_active && <span className="inline-flex rounded-full bg-red-100 text-red-700 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">Inactive</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edits.highlighted ?? plan.highlighted}
                              onChange={(e) => updatePlanField(plan.id, "highlighted", e.target.checked)}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                            Popular
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edits.is_active ?? plan.is_active}
                              onChange={(e) => updatePlanField(plan.id, "is_active", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Active
                          </label>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan Name</Label>
                          <Input
                            value={edits.name ?? plan.name}
                            onChange={(e) => updatePlanField(plan.id, "name", e.target.value)}
                            className="h-10 rounded-xl border-slate-200 bg-slate-50 font-semibold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">CTA Button Text</Label>
                          <Input
                            value={edits.cta ?? plan.cta}
                            onChange={(e) => updatePlanField(plan.id, "cta", e.target.value)}
                            className="h-10 rounded-xl border-slate-200 bg-slate-50 font-semibold"
                          />
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</Label>
                        <Input
                          value={edits.description ?? plan.description}
                          onChange={(e) => updatePlanField(plan.id, "description", e.target.value)}
                          className="h-10 rounded-xl border-slate-200 bg-slate-50 font-medium"
                        />
                      </div>
                      <div className="mt-4 space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Features (one per line)</Label>
                        <textarea
                          value={(edits.features ?? plan.features).join("\n")}
                          onChange={(e) => updatePlanField(plan.id, "features", e.target.value.split("\n").filter((f) => f.trim()))}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 focus:border-violet-500 focus:ring-violet-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price Matrix */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-black font-display text-slate-900">Price Matrix (USD)</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Set prices per currency. Enter amounts in major units (e.g. 50.00 for $50).</p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Add currency (EUR)"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="h-10 w-40 rounded-xl border-slate-200 bg-white"
                  />
                  <Button type="button" variant="outline" onClick={addCurrencyColumn} className="h-10 rounded-xl font-bold">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                  <Button type="button" onClick={savePricing} disabled={savingPrices} className="h-10 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md">
                    <Save className="h-4 w-4 mr-2" />
                    {savingPrices ? "Saving..." : "Save All Pricing"}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-500">Plan</th>
                      {currencies.map((currency) => (
                        <th key={currency} className="py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          {currency}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-4 pr-4 font-bold text-slate-900">{planEdits[plan.id]?.name ?? plan.name}</td>
                        {currencies.map((currency) => {
                          const key = `${plan.id}:${currency}`;
                          return (
                            <td key={key} className="py-3 px-2">
                              <Input
                                value={priceInputs[key] || ""}
                                onChange={(e) =>
                                  setPriceInputs((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                className="h-10 rounded-xl border-slate-200 bg-slate-50 text-sm font-semibold"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════
              TAB 3: Paystack Settings
              ═══════════════════════════════════ */}
          <TabsContent value="paystack" className="animate-fade-up">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black font-display text-slate-900">Paystack Configuration</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Enter your Paystack API keys. Get them from <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline font-bold">dashboard.paystack.com</a></p>
                </div>
                {paystackSecretKey && (
                  <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                    isTestKey ? "bg-amber-100 text-amber-700 border border-amber-200" :
                    isLiveKey ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                    "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {isTestKey ? "🧪 Test Mode" : isLiveKey ? "🟢 Live Mode" : "⚠️ Unknown Key Format"}
                  </span>
                )}
              </div>

              <div className="space-y-8">
                {/* API Keys Section */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <Key className="h-5 w-5 text-violet-500" /> API Keys
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mb-6">Your keys are stored securely and never exposed to the frontend.</p>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Public Key</Label>
                      <Input
                        value={paystackPublicKey}
                        onChange={(e) => setPaystackPublicKey(e.target.value)}
                        placeholder="pk_test_xxxxxxxxxxxxxxxxxxxx"
                        className="h-12 rounded-xl border-slate-200 bg-white font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Secret Key</Label>
                      <div className="relative">
                        <Input
                          type={showSecret ? "text" : "password"}
                          value={paystackSecretKey}
                          onChange={(e) => setPaystackSecretKey(e.target.value)}
                          placeholder="sk_test_xxxxxxxxxxxxxxxxxxxx"
                          className="h-12 pr-12 rounded-xl border-slate-200 bg-white font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Payment Callback URL</Label>
                      <Input
                        value={paystackCallbackUrl}
                        onChange={(e) => setPaystackCallbackUrl(e.target.value)}
                        placeholder="https://yourdomain.com/payment/callback"
                        className="h-12 rounded-xl border-slate-200 bg-white font-mono text-sm"
                      />
                      <p className="text-xs text-slate-400 font-medium">Leave blank to auto-detect from the user's browser URL.</p>
                    </div>
                  </div>
                </div>

                {/* Commission Settings */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <Percent className="h-5 w-5 text-emerald-500" /> Commission Settings
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mb-6">Configure platform commission on each transaction.</p>

                  <div className="grid gap-5 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Commission Type</Label>
                      <select
                        value={commissionType}
                        onChange={(e) => setCommissionType(e.target.value as "percentage" | "flat")}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 outline-none focus:border-violet-500 transition-all"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (USD)</option>
                      </select>
                    </div>

                    {commissionType === "percentage" ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-700">Percentage Value (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={commissionValue}
                          onChange={(e) => setCommissionValue(e.target.value)}
                          placeholder="2.5"
                          className="h-12 rounded-xl border-slate-200 bg-white font-bold text-lg"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-700">Flat Amount (USD)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={commissionFlatAmount}
                          onChange={(e) => setCommissionFlatAmount(e.target.value)}
                          placeholder="5.00"
                          className="h-12 rounded-xl border-slate-200 bg-white font-bold text-lg"
                        />
                      </div>
                    )}

                    <div className="flex items-end">
                      <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-3 w-full">
                        <p className="text-xs font-bold text-violet-500 uppercase tracking-wider">Preview</p>
                        <p className="text-lg font-black text-violet-700 mt-1">
                          {commissionType === "percentage" ? `${commissionValue}%` : `$${commissionFlatAmount}`}
                          <span className="text-xs font-bold text-violet-400 ml-1">per txn</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                  <Button
                    onClick={testPaystackConnection}
                    disabled={testingConnection || !paystackSecretKey}
                    variant="outline"
                    className="h-12 px-6 border-slate-200 bg-white text-slate-700 font-bold rounded-xl shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                  >
                    {testingConnection ? (
                      <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /> Testing...</span>
                    ) : (
                      <><TestTube className="h-4 w-4 mr-2" /> Test Connection</>
                    )}
                  </Button>
                  <Button
                    onClick={savePaystackSettings}
                    disabled={savingPaystack}
                    className="h-12 px-8 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all"
                  >
                    {savingPaystack ? (
                      <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Save Paystack Settings</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════
              TAB 4: Website Content (CMS)
              ═══════════════════════════════════ */}
          <TabsContent value="cms" className="animate-fade-up">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-black font-display text-slate-900">Website Content Manager</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">Edit all landing page text, testimonials, features, and more. Changes appear on the website immediately after saving.</p>
                </div>
                <Button
                  onClick={saveCmsContent}
                  disabled={savingCms}
                  className="h-12 px-8 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all"
                >
                  {savingCms ? (
                    <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save All Content</>
                  )}
                </Button>
              </div>

              {Object.keys(cmsSections).length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                  <div className="mx-auto h-16 w-16 bg-white rounded-full grid place-items-center mb-4 shadow-sm">
                    <Globe className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 mb-2">No Content Found</p>
                  <p className="text-slate-500 font-medium max-w-sm mx-auto">
                    Run the database migration to seed default website content.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(cmsSections).map(([section, rows]) => (
                    <div key={section} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        {sectionLabels[section] || `📝 ${section}`}
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-2">{rows.length} fields</span>
                      </h3>
                      <div className="space-y-4">
                        {rows.map((row) => {
                          const isJson = row.content_type === "json";
                          const isDirty = cmsEdits[row.id] !== row.value;
                          return (
                            <div key={row.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-bold text-slate-700">{row.label}</Label>
                                {isJson && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-wider">JSON</span>}
                                {isDirty && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Modified</span>}
                              </div>
                              {isJson || (cmsEdits[row.id] || "").length > 120 ? (
                                <textarea
                                  value={cmsEdits[row.id] ?? row.value}
                                  onChange={(e) => setCmsEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                  rows={isJson ? 6 : 3}
                                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:border-violet-500 focus:ring-violet-500 focus:outline-none resize-y ${
                                    isDirty ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"
                                  } ${isJson ? "font-mono text-xs" : ""}`}
                                />
                              ) : (
                                <Input
                                  value={cmsEdits[row.id] ?? row.value}
                                  onChange={(e) => setCmsEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                  className={`h-11 rounded-xl bg-white font-medium ${
                                    isDirty ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
