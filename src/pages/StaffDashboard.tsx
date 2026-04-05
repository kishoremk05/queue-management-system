import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { unlockAudio } from "@/utils/tts";
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Hash,
  Heart,
  LogOut,
  MessageSquare,
  Pause,
  Phone,
  Play,
  RotateCcw,
  SkipForward,
  StickyNote,
  Timer,
  User,
  Users,
  Zap,
} from "lucide-react";

/** Helper – calculate minutes since a given ISO date. */
function minutesSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function formatWait(min: number): string {
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function StaffDashboard() {
  const { signOut, organizationId, user } = useAuth();

  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [servingToken, setServingToken] = useState<any>(null);
  const [staffNotes, setStaffNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [transferServiceId, setTransferServiceId] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [recentDone, setRecentDone] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  const chimeRef = useRef<AudioContext | null>(null);
  const lastQueueSizeRef = useRef(0);

  // Tick every 15 seconds to update wait times
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!organizationId) return;
    const [ctr, svc, tkn, done] = await Promise.all([
      supabase.from("counters").select("*, services(name, prefix)").eq("organization_id", organizationId),
      supabase.from("services").select("*").eq("organization_id", organizationId),
      supabase.from("tokens").select("*, services(name, prefix), counters(counter_number)").eq("organization_id", organizationId).in("status", ["waiting", "serving"]).order("priority_rank").order("created_at"),
      supabase.from("tokens").select("*, services(name), counters(counter_number)").eq("organization_id", organizationId).eq("status", "done").order("created_at", { ascending: false }).limit(10),
    ]);
    setCounters(ctr.data || []);
    setServices(svc.data || []);
    setTokens(tkn.data || []);
    setRecentDone(done.data || []);
    setLoading(false);

    // Set currently serving token based on selected counter
    if (selectedCounter) {
      const current = (tkn.data || []).find((t: any) => t.status === "serving" && t.counter_id === selectedCounter.id);
      setServingToken(current || null);
      if (current?.staff_notes) setStaffNotes(current.staff_notes || "");
    }
  }, [organizationId, selectedCounter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`staff-tokens-${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens", filter: `organization_id=eq.${organizationId}` }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId, fetchAll]);

  // Play chime when queue grows
  useEffect(() => {
    if (!selectedCounter) return;
    const myServiceId = selectedCounter.service_id;
    const waitingForMe = tokens.filter((t) => t.status === "waiting" && t.service_id === myServiceId).length;

    if (waitingForMe > lastQueueSizeRef.current && lastQueueSizeRef.current > 0) {
      playChime();
    }
    lastQueueSizeRef.current = waitingForMe;
  }, [tokens, selectedCounter]);

  const playChime = () => {
    try {
      const ctx = chimeRef.current || new AudioContext();
      chimeRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  // ─── Actions ───────────────────────────────────────────────
  const callNext = async () => {
    if (!selectedCounter || actionLoading) return;
    setActionLoading(true);

    try {
      const waiting = tokens.filter((t) => t.status === "waiting" && t.service_id === selectedCounter.service_id);
      if (waiting.length === 0) { toast.info("No tokens waiting"); return; }

      const next = waiting[0];
      const { error } = await supabase.from("tokens").update({
        status: "serving",
        counter_id: selectedCounter.id,
        served_at: new Date().toISOString(),
      } as any).eq("id", next.id);
      if (error) throw error;

      setStaffNotes("");
      toast.success(`Calling ${next.token_number}`);
      // Log activity
      logAction("call_next", "token", next.id, { token_number: next.token_number, counter: selectedCounter.counter_number });
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const recallToken = async () => {
    if (!servingToken || actionLoading) return;
    // Just re-announce — token stays as serving
    toast.info(`Recalling ${servingToken.token_number}`);
    logAction("recall", "token", servingToken.id, { token_number: servingToken.token_number });
  };

  const skipToken = async () => {
    if (!servingToken || actionLoading) return;
    setActionLoading(true);
    try {
      const waitMinutes = minutesSince(servingToken.created_at);
      const { error } = await supabase.from("tokens").update({
        status: "skipped",
        completed_at: new Date().toISOString(),
        actual_wait_minutes: waitMinutes,
      } as any).eq("id", servingToken.id);
      if (error) throw error;
      toast.success(`Skipped ${servingToken.token_number}`);
      logAction("skip", "token", servingToken.id, { token_number: servingToken.token_number });
      setServingToken(null);
      setStaffNotes("");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const completeToken = async () => {
    if (!servingToken || actionLoading) return;
    setActionLoading(true);
    try {
      const waitMinutes = minutesSince(servingToken.created_at);
      const { error } = await supabase.from("tokens").update({
        status: "done",
        completed_at: new Date().toISOString(),
        actual_wait_minutes: waitMinutes,
        staff_notes: staffNotes || null,
      } as any).eq("id", servingToken.id);
      if (error) throw error;
      toast.success(`Completed ${servingToken.token_number}`);
      logAction("complete", "token", servingToken.id, { token_number: servingToken.token_number });
      setServingToken(null);
      setStaffNotes("");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const transferToken = async () => {
    if (!servingToken || !transferServiceId || actionLoading) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("tokens").update({
        service_id: transferServiceId,
        status: "waiting",
        counter_id: null,
        served_at: null,
      } as any).eq("id", servingToken.id);
      if (error) throw error;
      const svcName = services.find((s) => s.id === transferServiceId)?.name || "another queue";
      toast.success(`Transferred ${servingToken.token_number} to ${svcName}`);
      logAction("transfer", "token", servingToken.id, { to_service: transferServiceId });
      setServingToken(null);
      setShowTransfer(false);
      setStaffNotes("");
      await fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!servingToken) return;
    try {
      await supabase.from("tokens").update({ staff_notes: staffNotes || null } as any).eq("id", servingToken.id);
      toast.success("Notes saved");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const logAction = async (action: string, entityType: string, entityId: string, details: any = {}) => {
    try {
      await supabase.from("activity_logs").insert({
        organization_id: organizationId,
        user_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      } as any);
    } catch {}
  };

  // Derived data
  const myServiceTokens = selectedCounter ? tokens.filter((t) => t.status === "waiting" && t.service_id === selectedCounter.service_id) : [];
  const allWaiting = tokens.filter((t) => t.status === "waiting");
  const allServing = tokens.filter((t) => t.status === "serving");

  // Counter selection screen
  if (!selectedCounter) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-md">
                <span className="text-base font-bold text-white">Q</span>
              </div>
              <div>
                <h1 className="text-lg font-bold font-display text-slate-900 leading-tight">Staff Dashboard</h1>
                <p className="text-xs font-medium text-slate-500">Select your counter to begin</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={signOut} className="text-slate-600 hover:text-red-700 hover:bg-red-50 font-semibold rounded-xl">
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl p-6 lg:p-10">
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
          ) : (
            <>
              <h2 className="text-2xl font-black font-display text-slate-900 mb-6">Your Counters</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {counters.map((c) => {
                  const queueSize = tokens.filter((t) => t.status === "waiting" && t.service_id === c.service_id).length;
                  return (
                    <button key={c.id} onClick={() => { setSelectedCounter(c); unlockAudio(); }} className="group rounded-3xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 group-hover:bg-violet-600 text-violet-600 group-hover:text-white font-display text-2xl font-black transition-colors">
                          {c.counter_number}
                        </div>
                        <div>
                          <p className="text-lg font-bold text-slate-900">Counter {c.counter_number}</p>
                          <p className="text-sm font-bold text-violet-600">{c.services?.name || "Unassigned"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Users className="h-4 w-4" />
                        {queueSize} waiting
                      </div>
                    </button>
                  );
                })}
                {counters.length === 0 && (
                  <div className="col-span-full text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-lg font-bold text-slate-400">No counters assigned to you.</p>
                    <p className="text-sm text-slate-400 mt-1">Contact your admin to get assigned to a counter.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  // Main staff dashboard
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm px-4 sm:px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-md">
              <span className="font-bold text-white">Q</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-display text-slate-900 leading-tight">
                Counter {selectedCounter.counter_number} — {selectedCounter.services?.name}
              </h1>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-0.5">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {myServiceTokens.length} waiting</span>
                <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {allServing.length} serving</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedCounter(null)} className="text-slate-600 rounded-xl font-bold text-xs sm:text-sm">
              Change Counter
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut} className="text-slate-600 hover:text-red-700 hover:bg-red-50 font-semibold rounded-xl text-xs sm:text-sm">
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ─── Left: Currently Serving ─── */}
          <section className="flex-1 space-y-4">
            {servingToken ? (
              <>
                {/* Current customer card */}
                <div className="rounded-3xl border-2 border-violet-200 bg-white p-6 sm:p-8 shadow-lg shadow-violet-500/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-violet-50 to-transparent rounded-bl-full" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-xs font-black text-violet-600 uppercase tracking-widest">Now Serving</p>
                      <div className="flex items-center gap-2 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                        <Timer className="h-4 w-4" />
                        Waiting {formatWait(minutesSince(servingToken.created_at))}
                      </div>
                    </div>
                    
                    {/* Token number */}
                    <div className="text-center mb-6">
                      <p className="text-7xl sm:text-8xl font-black font-display text-slate-900 tracking-tighter leading-none">{servingToken.token_number}</p>
                      <p className="text-base font-bold text-violet-600 mt-2">{servingToken.services?.name}</p>
                      {servingToken.priority_level && servingToken.priority_level !== "normal" && (
                        <span className={`mt-2 inline-flex px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                          servingToken.priority_level === "vip" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                          servingToken.priority_level === "elderly" ? "bg-teal-100 text-teal-700 border border-teal-200" :
                          "bg-red-100 text-red-700 border border-red-200"
                        }`}>
                          {servingToken.priority_level === "vip" && <Crown className="h-3 w-3 mr-1.5" />}
                          {servingToken.priority_level === "elderly" && <Heart className="h-3 w-3 mr-1.5" />}
                          {servingToken.priority_level === "urgent" && <Zap className="h-3 w-3 mr-1.5" />}
                          {servingToken.priority_level}
                        </span>
                      )}
                    </div>

                    {/* Customer Details */}
                    {(servingToken.customer_name || servingToken.customer_phone || servingToken.visit_reason) && (
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-6 space-y-3">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <User className="h-3.5 w-3.5" /> Customer Details
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {servingToken.customer_name && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="text-sm font-bold text-slate-800">{servingToken.customer_name}</span>
                            </div>
                          )}
                          {servingToken.customer_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="text-sm font-bold text-slate-800">{servingToken.customer_phone}</span>
                            </div>
                          )}
                        </div>
                        {servingToken.visit_reason && (
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-slate-700">{servingToken.visit_reason}</p>
                          </div>
                        )}
                        {servingToken.notification_opt_in && (
                          <div className="flex items-center gap-2 text-xs font-bold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg">
                            <Bell className="h-3 w-3" />
                            Notification enabled ({servingToken.notification_channel || "SMS"})
                          </div>
                        )}
                      </div>
                    )}

                    {/* Staff Notes */}
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 mb-6">
                      <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <StickyNote className="h-3.5 w-3.5" /> Staff Notes
                      </p>
                      <Textarea
                        value={staffNotes}
                        onChange={(e) => setStaffNotes(e.target.value)}
                        placeholder="Add notes about this customer visit..."
                        className="min-h-[60px] rounded-xl border-amber-200 bg-white text-sm font-medium resize-none focus:border-amber-400"
                      />
                      <Button onClick={saveNotes} size="sm" variant="outline" className="mt-2 h-8 text-xs font-bold rounded-lg border-amber-200 text-amber-700 hover:bg-amber-100">
                        <FileText className="h-3 w-3 mr-1" /> Save Notes
                      </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid gap-3 grid-cols-2">
                      <Button onClick={completeToken} disabled={actionLoading} className="h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 text-base active:scale-[0.98] transition-all">
                        <CheckCircle2 className="h-5 w-5 mr-2" /> Complete
                      </Button>
                      <Button onClick={recallToken} disabled={actionLoading} variant="outline" className="h-14 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold rounded-2xl text-base active:scale-[0.98] transition-all">
                        <RotateCcw className="h-5 w-5 mr-2" /> Recall
                      </Button>
                      <Button onClick={skipToken} disabled={actionLoading} variant="outline" className="h-14 border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-2xl text-base active:scale-[0.98] transition-all">
                        <SkipForward className="h-5 w-5 mr-2" /> Skip
                      </Button>
                      <Button onClick={() => setShowTransfer(!showTransfer)} variant="outline" className="h-14 border-2 border-amber-200 text-amber-700 hover:bg-amber-50 font-bold rounded-2xl text-base active:scale-[0.98] transition-all">
                        <ArrowLeftRight className="h-5 w-5 mr-2" /> Transfer
                      </Button>
                    </div>

                    {/* Transfer panel */}
                    {showTransfer && (
                      <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 animate-fade-up space-y-3">
                        <p className="text-sm font-bold text-slate-700">Transfer to:</p>
                        <select value={transferServiceId} onChange={(e) => setTransferServiceId(e.target.value)} className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-700 focus:border-violet-500">
                          <option value="" disabled>Select service queue</option>
                          {services.filter((s) => s.id !== selectedCounter.service_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <Button onClick={transferToken} disabled={!transferServiceId || actionLoading} className="h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex-1">
                            <ArrowRight className="h-4 w-4 mr-1" /> Confirm Transfer
                          </Button>
                          <Button onClick={() => setShowTransfer(false)} variant="outline" className="h-10 rounded-xl font-bold">Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* No one being served — Call Next */
              <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-50 mb-6 border-2 border-slate-200">
                  <Users className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-2xl font-black font-display text-slate-900 mb-2">No One Being Served</h3>
                <p className="text-sm text-slate-500 font-medium mb-8">
                  {myServiceTokens.length > 0
                    ? `${myServiceTokens.length} token${myServiceTokens.length > 1 ? "s" : ""} waiting in your queue`
                    : "Your queue is empty"}
                </p>
                <Button
                  onClick={callNext}
                  disabled={actionLoading || myServiceTokens.length === 0}
                  className="h-16 px-8 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xl font-black rounded-2xl shadow-2xl shadow-violet-600/30 hover:shadow-violet-600/50 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-3"><span className="h-5 w-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> Calling...</span>
                  ) : (
                    <><Play className="h-6 w-6 mr-3" /> Call Next Token</>
                  )}
                </Button>
              </div>
            )}

            {/* Recently completed */}
            {recentDone.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Recently Completed
                </h3>
                <div className="space-y-2">
                  {recentDone.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-black font-display text-slate-700">{t.token_number}</span>
                        <span className="text-xs font-bold text-slate-400">{t.services?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400">Counter {t.counters?.counter_number || "—"}</span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Done</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ─── Right: Queue ─── */}
          <aside className="lg:w-[380px] xl:w-[420px] shrink-0 space-y-4">
            {/* Call next button (when serving) */}
            {servingToken && myServiceTokens.length > 0 && (
              <Button onClick={callNext} disabled={actionLoading} className="w-full h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black rounded-2xl text-lg shadow-xl shadow-violet-500/20 active:scale-[0.98]">
                <Play className="h-5 w-5 mr-2" /> Call Next ({myServiceTokens.length})
              </Button>
            )}

            {/* My service queue */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-4 w-4 text-violet-500" /> My Queue
                </h3>
                <span className="text-xs font-bold text-white bg-violet-600 px-2.5 py-1 rounded-full">{myServiceTokens.length}</span>
              </div>
              {myServiceTokens.length > 0 ? (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {myServiceTokens.map((t, idx) => (
                    <div key={t.id} className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                      idx === 0 ? "bg-violet-50 border-2 border-violet-200" : "bg-slate-50 border border-slate-100"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black font-display text-slate-900">{t.token_number}</span>
                        {t.priority_level && t.priority_level !== "normal" && (
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            t.priority_level === "vip" ? "bg-amber-100 text-amber-700" :
                            t.priority_level === "elderly" ? "bg-teal-100 text-teal-700" :
                            "bg-red-100 text-red-700"
                          }`}>{t.priority_level}</span>
                        )}
                        {t.customer_name && (
                          <span className="text-xs font-medium text-slate-500 hidden sm:inline">{t.customer_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatWait(minutesSince(t.created_at))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Queue is empty</p>
                </div>
              )}
            </div>

            {/* All queues overview */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-500" /> All Queues
              </h3>
              <div className="space-y-2">
                {services.map((s) => {
                  const sWaiting = allWaiting.filter((t) => t.service_id === s.id).length;
                  const sServing = allServing.filter((t) => t.service_id === s.id).length;
                  const isMine = s.id === selectedCounter.service_id;
                  return (
                    <div key={s.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                      isMine ? "bg-violet-50 border-2 border-violet-200" : "bg-slate-50 border border-slate-100"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{s.name}</span>
                        {isMine && <span className="text-[10px] font-black text-violet-600 bg-violet-100 px-2 py-0.5 rounded-md">You</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-amber-600">{sWaiting} waiting</span>
                        <span className="text-emerald-600">{sServing} serving</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
