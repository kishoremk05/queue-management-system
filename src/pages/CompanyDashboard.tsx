import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { generateReport, exportToCSV, exportToPDF, type ReportData } from "@/utils/reports";
import {
  BarChart3,
  Box,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hash,
  LayoutDashboard,
  LogOut,
  Monitor,
  Plus,
  ScanLine,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function CompanyDashboard() {
  const { signOut, organizationId } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [staffRequests, setStaffRequests] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [newService, setNewService] = useState("");
  const [newServicePrefix, setNewServicePrefix] = useState("A");
  const [newCounterServiceId, setNewCounterServiceId] = useState("");
  const [newCounterNumber, setNewCounterNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [reportLoading, setReportLoading] = useState(false);

  const fetchAll = async () => {
    if (!organizationId) return;
    const [svc, ctr, staff, tkn] = await Promise.all([
      supabase.from("services").select("*").eq("organization_id", organizationId),
      supabase.from("counters").select("*, services(name)").eq("organization_id", organizationId),
      supabase.from("staff_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("tokens").select("*, services(name), counters(counter_number)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    ]);
    setServices(svc.data || []);
    setCounters(ctr.data || []);
    setStaffRequests(staff.data || []);
    setTokens(tkn.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [organizationId]);

  const loadReport = async () => {
    if (!organizationId) return;
    setReportLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      if (reportPeriod === "daily") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
      } else if (reportPeriod === "weekly") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
      }
      const data = await generateReport(organizationId, startDate, now);
      setReportData(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load report");
    } finally {
      setReportLoading(false);
    }
  };

  const addService = async () => {
    if (!newService.trim() || !organizationId) return;
    const { error } = await supabase.from("services").insert({
      organization_id: organizationId,
      name: newService.trim(),
      prefix: newServicePrefix.toUpperCase(),
    });
    if (error) toast.error(error.message);
    else { setNewService(""); toast.success("Service added"); fetchAll(); }
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Service deleted"); fetchAll(); }
  };

  const addCounter = async () => {
    if (!newCounterServiceId || !newCounterNumber || !organizationId) return;
    const { error } = await supabase.from("counters").insert({
      organization_id: organizationId,
      service_id: newCounterServiceId,
      counter_number: parseInt(newCounterNumber),
    });
    if (error) toast.error(error.message);
    else { setNewCounterNumber(""); toast.success("Counter added"); fetchAll(); }
  };

  const deleteCounter = async (id: string) => {
    const { error } = await supabase.from("counters").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Counter deleted"); fetchAll(); }
  };

  const approveStaff = async (req: any) => {
    try {
      const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: req.user_id, role: "staff", organization_id: organizationId });
      if (roleErr) throw roleErr;
      const { error: profErr } = await supabase.from("profiles").insert({ user_id: req.user_id, name: req.name, email: req.email, organization_id: organizationId });
      if (profErr) throw profErr;
      const { error } = await supabase.from("staff_requests").update({ status: "approved" }).eq("id", req.id);
      if (error) throw error;
      toast.success("Staff approved");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const rejectStaff = async (id: string) => {
    const { error } = await supabase.from("staff_requests").update({ status: "rejected" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Staff rejected"); fetchAll(); }
  };

  const copyOrganizationId = async () => {
    if (!organizationId) return;
    try {
      await navigator.clipboard.writeText(organizationId);
      toast.success("Company ID copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Stats
  const activeTokens = tokens.filter((t) => t.status === "waiting" || t.status === "serving").length;
  const servedToday = tokens.filter((t) => t.status === "done").length;
  const skippedToday = tokens.filter((t) => t.status === "skipped").length;
  const pendingStaff = staffRequests.filter((s) => s.status === "pending").length;

  // Chart data
  const serviceChartData = services.map((s) => ({
    name: s.name,
    tokens: tokens.filter((t) => t.service_id === s.id).length,
  }));

  const statusDistribution = [
    { name: "Waiting", value: tokens.filter((t) => t.status === "waiting").length, color: "#f59e0b" },
    { name: "Serving", value: tokens.filter((t) => t.status === "serving").length, color: "#3b82f6" },
    { name: "Done", value: tokens.filter((t) => t.status === "done").length, color: "#10b981" },
    { name: "Skipped", value: tokens.filter((t) => t.status === "skipped").length, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-md shadow-violet-500/20">
              <span className="text-base font-bold text-white">Q</span>
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-slate-900 leading-tight">Company Dashboard</h1>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                <span>Org ID:</span>
                <code className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{organizationId?.slice(0, 8)}...</code>
                <button onClick={copyOrganizationId} className="text-violet-600 hover:text-violet-700 transition-colors bg-violet-50 p-1 rounded-md">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="text-slate-600 hover:text-violet-700 hover:bg-violet-50 font-semibold rounded-xl">
              <Link to={`/kiosk/${organizationId}`}>
                <ScanLine className="h-4 w-4 mr-2" />
                Kiosk
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-slate-600 hover:text-violet-700 hover:bg-violet-50 font-semibold rounded-xl">
              <Link to={`/display/${organizationId}`}>
                <Monitor className="h-4 w-4 mr-2" />
                Display
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-1" />
            <Button size="sm" variant="ghost" onClick={signOut} className="text-slate-600 hover:text-red-700 hover:bg-red-50 font-semibold rounded-xl">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 lg:p-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-32 w-full rounded-3xl bg-white border border-slate-200" />))}
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <TabsTrigger value="overview" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
                <LayoutDashboard className="h-4 w-4 mr-2" /> Overview
              </TabsTrigger>
              <TabsTrigger value="services" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
                <Box className="h-4 w-4 mr-2" /> Services
              </TabsTrigger>
              <TabsTrigger value="counters" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
                <Hash className="h-4 w-4 mr-2" /> Counters
              </TabsTrigger>
              <TabsTrigger value="staff" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
                <Users className="h-4 w-4 mr-2" /> Staff
                {pendingStaff > 0 && <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-md bg-red-100 text-red-700 text-[10px] font-black">{pendingStaff}</span>}
              </TabsTrigger>
              <TabsTrigger value="queue" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
                <ClipboardList className="h-4 w-4 mr-2" /> Queue
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-xl px-4 font-semibold text-slate-500 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all">
                <BarChart3 className="h-4 w-4 mr-2" /> Reports
              </TabsTrigger>
            </TabsList>

            {/* ─── Overview Tab ─── */}
            <TabsContent value="overview" className="space-y-6 animate-fade-up">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Active Tokens", value: activeTokens, icon: ClipboardList, color: "text-violet-600", bg: "from-violet-100 to-violet-50" },
                  { label: "Served Today", value: servedToday, icon: CheckCircle2, color: "text-emerald-600", bg: "from-emerald-100 to-emerald-50" },
                  { label: "Services", value: services.length, icon: Box, color: "text-blue-600", bg: "from-blue-100 to-blue-50" },
                  { label: "Staff Members", value: staffRequests.filter((s) => s.status === "approved").length, icon: Users, color: "text-amber-600", bg: "from-amber-100 to-amber-50" },
                ].map((stat) => {
                  const StatIcon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${stat.bg}`}>
                          <StatIcon className={`h-6 w-6 ${stat.color}`} />
                        </div>
                        <TrendingUp className="h-5 w-5 text-emerald-500 bg-emerald-50 p-1 rounded-full" />
                      </div>
                      <p className="text-4xl font-black text-slate-900 font-display tracking-tight">{stat.value}</p>
                      <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Tokens by Service Chart */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-6">Tokens by Service</h3>
                  {serviceChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={serviceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                        <Bar dataKey="tokens" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-slate-400 font-medium">No data yet</div>
                  )}
                </div>

                {/* Status Distribution */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-6">Token Status Distribution</h3>
                  {statusDistribution.length > 0 ? (
                    <div className="flex items-center gap-8 h-[250px]">
                      <ResponsiveContainer width="50%" height="100%">
                        <PieChart>
                          <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                            {statusDistribution.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-4 flex-1">
                        {statusDistribution.map((item) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                              <span className="text-sm font-semibold text-slate-600">{item.name}</span>
                            </div>
                            <span className="font-bold text-slate-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-slate-400 font-medium">No tokens yet</div>
                  )}
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Link to={`/kiosk/${organizationId}`} className="group flex items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-violet-200 transition-all">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 group-hover:bg-violet-100 transition-colors">
                    <ScanLine className="h-6 w-6 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 text-lg group-hover:text-violet-700 transition-colors">Open Kiosk</p>
                    <p className="text-sm font-medium text-slate-500">Self-service token generation</p>
                  </div>
                  <div className="h-10 w-10 grid place-items-center rounded-full bg-slate-50 group-hover:bg-violet-50 transition-colors">
                     <ExternalLink className="h-5 w-5 text-slate-400 group-hover:text-violet-600 transition-colors" />
                  </div>
                </Link>
                <Link to={`/display/${organizationId}`} className="group flex items-center gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
                    <Monitor className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">Queue Display</p>
                    <p className="text-sm font-medium text-slate-500">Live queue status board</p>
                  </div>
                  <div className="h-10 w-10 grid place-items-center rounded-full bg-slate-50 group-hover:bg-blue-50 transition-colors">
                    <ExternalLink className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </Link>
              </div>
            </TabsContent>

            {/* ─── Services Tab ─── */}
            <TabsContent value="services" className="animate-fade-up">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black font-display text-slate-900">Manage Services</h3>
                  <span className="inline-flex py-1 px-3 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{services.length} service{services.length !== 1 && "s"}</span>
                </div>
                <div className="flex flex-wrap gap-3 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Input placeholder="Service name e.g. Billing" value={newService} onChange={(e) => setNewService(e.target.value)} className="h-12 flex-1 rounded-xl border-slate-200 bg-white text-slate-900 focus:border-violet-500 focus:ring-violet-500 font-medium" />
                  <Input placeholder="Prefix" value={newServicePrefix} maxLength={1} className="w-24 h-12 rounded-xl border-slate-200 bg-white text-slate-900 text-center uppercase font-bold focus:border-violet-500 focus:ring-violet-500" onChange={(e) => setNewServicePrefix(e.target.value)} />
                  <Button onClick={addService} className="h-12 px-6 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95">
                    <Plus className="h-5 w-5 mr-2" /> Add Service
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((s) => (
                    <div key={s.id} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-violet-200 hover:shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 font-display text-xl font-bold text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">{s.prefix}</div>
                        <span className="font-bold text-slate-900">{s.name}</span>
                      </div>
                      <button onClick={() => deleteService(s.id)} className="h-10 w-10 grid place-items-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  {services.length === 0 && <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50"><p className="text-slate-500 font-medium">No services yet. Add one above to get started.</p></div>}
                </div>
              </div>
            </TabsContent>

            {/* ─── Counters Tab ─── */}
            <TabsContent value="counters" className="animate-fade-up">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black font-display text-slate-900">Manage Counters</h3>
                  <span className="inline-flex py-1 px-3 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{counters.length} counter{counters.length !== 1 && "s"}</span>
                </div>
                <div className="flex flex-wrap gap-3 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <select className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" value={newCounterServiceId} onChange={(e) => setNewCounterServiceId(e.target.value)}>
                    <option value="" disabled>Select a service for this counter</option>
                    {services.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                  <Input placeholder="Counter #" type="number" value={newCounterNumber} onChange={(e) => setNewCounterNumber(e.target.value)} className="w-32 h-12 rounded-xl border-slate-200 bg-white text-slate-900 font-bold focus:border-violet-500 focus:ring-violet-500" />
                  <Button onClick={addCounter} className="h-12 px-6 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95">
                    <Plus className="h-5 w-5 mr-2" /> Add Counter
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {counters.map((c) => (
                    <div key={c.id} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-violet-200 hover:shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-50 group-hover:bg-violet-50 text-slate-500 group-hover:text-violet-600 font-display text-xl font-black transition-colors">
                           {c.counter_number}
                         </div>
                         <div>
                          <p className="font-bold text-slate-900">Counter {c.counter_number}</p>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">{c.services?.name || "Unassigned"}</p>
                         </div>
                      </div>
                      <button onClick={() => deleteCounter(c.id)} className="h-10 w-10 grid place-items-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  {counters.length === 0 && <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50"><p className="text-slate-500 font-medium col-span-full">No counters yet</p></div>}
                </div>
              </div>
            </TabsContent>

            {/* ─── Staff Tab ─── */}
            <TabsContent value="staff" className="animate-fade-up">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className="text-2xl font-black font-display text-slate-900 mb-8">Staff Members & Requests</h3>
                <div className="space-y-4">
                  {staffRequests.map((req) => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-violet-50 shrink-0">
                          <Users className="h-6 w-6 text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-base truncate">{req.name}</p>
                          <p className="text-sm font-medium text-slate-500 truncate">{req.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 mt-2 sm:mt-0">
                        <StatusBadge status={req.status} />
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => approveStaff(req)} className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm">
                              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                            </Button>
                            <Button size="sm" onClick={() => rejectStaff(req.id)} variant="outline" className="h-9 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold rounded-xl shadow-sm">
                              <XCircle className="h-4 w-4 mr-1.5" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {staffRequests.length === 0 && <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50"><p className="text-slate-500 font-medium">No staff requests yet</p></div>}
                </div>
              </div>
            </TabsContent>

            {/* ─── Queue Tab ─── */}
            <TabsContent value="queue" className="animate-fade-up">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black font-display text-slate-900">Recent Queue Activity</h3>
                  <span className="inline-flex py-1 px-3 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{tokens.length} recent tokens</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="pb-4 px-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Token</th>
                        <th className="pb-4 px-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Service</th>
                        <th className="pb-4 px-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Status</th>
                        <th className="pb-4 px-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Priority</th>
                        <th className="pb-4 px-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Counter</th>
                        <th className="pb-4 px-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Time Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                          <td className="py-4 px-4 font-display font-black text-slate-900 text-lg group-hover:text-violet-600">{t.token_number}</td>
                          <td className="py-4 px-4 font-medium text-slate-600">{t.services?.name}</td>
                          <td className="py-4 px-4"><StatusBadge status={t.status} /></td>
                          <td className="py-4 px-4">
                             {t.priority_level && t.priority_level !== "normal" ? (
                               <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                 t.priority_level === "vip" ? "bg-amber-100 text-amber-700" :
                                 t.priority_level === "elderly" ? "bg-teal-100 text-teal-700" :
                                 "bg-red-100 text-red-700"
                               }`}>{t.priority_level}</span>
                             ) : (
                               <span className="text-sm font-medium text-slate-400">Normal</span>
                             )}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-700">{t.counters?.counter_number || "—"}</td>
                          <td className="py-4 px-4 font-medium text-slate-500">{new Date(t.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tokens.length === 0 && <div className="py-12 text-center text-slate-500 font-medium">No tokens generated yet.</div>}
                </div>
              </div>
            </TabsContent>

            {/* ─── Reports Tab ─── */}
            <TabsContent value="reports" className="space-y-6 animate-fade-up">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <h3 className="text-2xl font-black font-display text-slate-900">Queue Analytics & Reports</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                      {(["daily", "weekly", "monthly"] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setReportPeriod(period)}
                          className={`rounded-lg px-5 py-2 text-sm font-bold capitalize transition-all ${
                            reportPeriod === period ? "bg-white text-violet-700 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                    <Button onClick={loadReport} disabled={reportLoading} className="h-11 px-6 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-bold shadow-md">
                      {reportLoading ? (
                        <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating</span>
                      ) : (
                        <><Calendar className="h-4 w-4 mr-2" /> Generate Report</>
                      )}
                    </Button>
                  </div>
                </div>

                {reportData ? (
                  <div className="space-y-8 animate-fade-up">
                    {/* Summary cards */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: "Total Tokens", value: reportData.summary.totalTokens },
                        { label: "Total Served", value: reportData.summary.totalServed },
                        { label: "No Shows/Skipped", value: reportData.summary.totalSkipped },
                        { label: "Average Wait Time", value: `${reportData.summary.avgWait} min` },
                        { label: "Busiest Period", value: reportData.summary.busiestDay },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                          <p className="mt-2 text-3xl font-black text-slate-900 font-display tracking-tight">{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Bar Chart */}
                    {reportData.stats.length > 0 && (
                      <div className="rounded-2xl border border-slate-100 p-6">
                        <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                           <BarChart3 className="h-5 w-5 text-violet-500" /> Token Volume Overview
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={reportData.stats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                            <Bar dataKey="totalTokens" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Tokens" />
                            <Bar dataKey="served" fill="#10b981" radius={[4, 4, 0, 0]} name="Served" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Export buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <Button onClick={() => exportToCSV(reportData)} variant="outline" className="h-11 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 text-slate-700 font-bold rounded-xl transition-all">
                        <Download className="h-4 w-4 mr-2" /> Download CSV
                      </Button>
                      <Button onClick={() => exportToPDF(reportData)} variant="outline" className="h-11 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 text-slate-700 font-bold rounded-xl transition-all">
                        <FileText className="h-4 w-4 mr-2" /> Download PDF Report
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                    <div className="mx-auto h-16 w-16 bg-white rounded-full grid place-items-center mb-4 shadow-sm">
                      <BarChart3 className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-xl font-bold text-slate-900 mb-2">No Report Selected</p>
                    <p className="text-slate-500 font-medium">Select a time period above and click "Generate Report" to view analytics and download exports.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
