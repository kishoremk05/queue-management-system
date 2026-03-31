import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { TransferDialog } from "@/components/TransferDialog";
import { playChime } from "@/utils/tts";
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  LogOut,
  PhoneCall,
  RefreshCw,
  SkipForward,
  Users,
} from "lucide-react";

interface ActionLog {
  action: string;
  token: string;
  time: Date;
}

export default function StaffDashboard() {
  const { signOut, organizationId, profile } = useAuth();
  const [tokens, setTokens] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [currentToken, setCurrentToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  const logAction = useCallback((action: string, token: string) => {
    setActionLogs((prev) => [{action, token, time: new Date()}, ...prev].slice(0, 20));
  }, []);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    const [svc, ctr, tkn] = await Promise.all([
      supabase.from("services").select("*").eq("organization_id", organizationId),
      supabase.from("counters").select("*, services(name)").eq("organization_id", organizationId),
      supabase.from("tokens").select("*, services(name, prefix), counters(counter_number)").eq("organization_id", organizationId).in("status", ["waiting", "serving"]).order("priority_rank", { ascending: true }).order("created_at", { ascending: true }),
    ]);
    setServices(svc.data || []);
    setCounters(ctr.data || []);
    setTokens(tkn.data || []);
    setLoading(false);

    const servingToken = (tkn.data || []).find((t: any) => t.status === "serving" && t.counter_id === selectedCounter);
    setCurrentToken(servingToken || null);
  }, [organizationId, selectedCounter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel("staff-tokens")
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens", filter: `organization_id=eq.${organizationId}` }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId, fetchData]);

  const callNext = async () => {
    if (!selectedCounter) {
      toast.error("Please select a counter first");
      return;
    }
    setActionLoading(true);
    try {
      const counter = counters.find((c) => c.id === selectedCounter);
      if (!counter) throw new Error("Counter not found");

      const waitingTokens = tokens.filter((t) => t.status === "waiting" && t.service_id === counter.service_id);
      if (waitingTokens.length === 0) {
        toast.info("No more tokens in the queue");
        setActionLoading(false);
        return;
      }

      const nextToken = waitingTokens[0];
      
      // Complete current token if exists
      if (currentToken) {
        await supabase.from("tokens").update({ status: "done" }).eq("id", currentToken.id);
        logAction("Completed", currentToken.token_number);
      }

      const { error } = await supabase
        .from("tokens")
        .update({ status: "serving", counter_id: selectedCounter })
        .eq("id", nextToken.id);

      if (error) throw error;

      logAction("Called", nextToken.token_number);
      playChime();
      toast.success(`Now serving: ${nextToken.token_number}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to call next");
    } finally {
      setActionLoading(false);
    }
  };

  const recallToken = async () => {
    if (!currentToken) return;
    playChime();
    logAction("Recalled", currentToken.token_number);
    toast.success(`Recalled: ${currentToken.token_number}`);
  };

  const skipToken = async () => {
    if (!currentToken) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("tokens")
        .update({ status: "skipped" })
        .eq("id", currentToken.id);
      if (error) throw error;
      logAction("Skipped", currentToken.token_number);
      toast.success(`Skipped: ${currentToken.token_number}`);
      setCurrentToken(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const completeToken = async () => {
    if (!currentToken) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("tokens")
        .update({ status: "done" })
        .eq("id", currentToken.id);
      if (error) throw error;
      logAction("Completed", currentToken.token_number);
      toast.success(`Completed: ${currentToken.token_number}`);
      setCurrentToken(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const waitingTokens = tokens.filter((t) => t.status === "waiting");
  const selectedCounterData = counters.find((c) => c.id === selectedCounter);

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
              <h1 className="text-lg font-bold font-display text-slate-900 leading-tight">Staff Dashboard</h1>
              <p className="text-xs font-medium text-slate-500">{profile?.name || "Staff Member"}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut} className="text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl font-medium">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-8 w-8 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1fr_340px]">
            {/* Main Column */}
            <div className="space-y-6 lg:space-y-8">
              {/* Counter Selection */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-4">Select Your Counter</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {counters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCounter(c.id);
                        const serving = tokens.find((t) => t.status === "serving" && t.counter_id === c.id);
                        setCurrentToken(serving || null);
                      }}
                      className={`group rounded-2xl border p-4 text-left transition-all ${
                        selectedCounter === c.id
                          ? "border-violet-300 bg-violet-50 shadow-md shadow-violet-500/10 scale-[1.02]"
                          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`grid h-12 w-12 place-items-center rounded-xl text-xl font-bold transition-colors ${
                          selectedCounter === c.id ? "bg-violet-600 text-white shadow-md shadow-violet-600/20" : "bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-600"
                        }`}>
                          {c.counter_number}
                        </div>
                        <div>
                          <p className={`font-bold transition-colors ${selectedCounter === c.id ? "text-violet-900" : "text-slate-900 group-hover:text-violet-700"}`}>
                            Counter {c.counter_number}
                          </p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 max-w-[120px] truncate">{c.services?.name}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {counters.length === 0 && (
                    <div className="col-span-full py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                      <p className="text-sm font-medium text-slate-500">No counters assigned to your organization yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Now Serving */}
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm relative overflow-hidden">
                {/* Decorative background for current token */}
                {currentToken && (
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-20 pointer-events-none" />
                )}

                <div className="flex items-center justify-between mb-8 relative z-10">
                  <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">Now Serving</h3>
                  {currentToken && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Active
                    </span>
                  )}
                </div>

                {currentToken ? (
                  <div className="text-center py-6 animate-scale-in relative z-10">
                    <p className="text-8xl md:text-9xl font-black text-slate-900 tracking-tighter font-display mb-2 drop-shadow-sm">
                      {currentToken.token_number}
                    </p>
                    <p className="text-lg font-medium text-slate-500">
                      {currentToken.services?.name} <span className="mx-2 text-slate-300">•</span> Counter {selectedCounterData?.counter_number}
                    </p>
                    {currentToken.priority_level && currentToken.priority_level !== "normal" && (
                      <div className="mt-4">
                        <span className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider ${
                          currentToken.priority_level === "vip" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                          currentToken.priority_level === "elderly" ? "bg-teal-100 text-teal-700 border border-teal-200" :
                          "bg-red-100 text-red-700 border border-red-200"
                        }`}>
                          {currentToken.priority_level} Priority
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-slate-50 border border-slate-100 shadow-sm">
                      <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-xl font-bold text-slate-900 mb-1">Ready to serve</p>
                    <p className="text-slate-500">Select a counter and call the next customer</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 relative z-10">
                  <Button onClick={callNext} disabled={actionLoading || !selectedCounter}
                    className="h-14 bg-gradient-to-r from-emerald-500 to-teal-500 border border-emerald-600/20 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:-translate-y-0.5 active:scale-95 lg:col-span-2 text-base">
                    <PhoneCall className="h-5 w-5 mr-3" />
                    Call Next Customer
                  </Button>
                  <Button onClick={recallToken} disabled={!currentToken} variant="outline"
                    className="h-14 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-violet-600 hover:border-violet-200 font-semibold rounded-xl transition-all">
                    <RefreshCw className="h-4 w-4 mr-2" /> Recall
                  </Button>
                  <Button onClick={skipToken} disabled={!currentToken || actionLoading} variant="outline"
                    className="h-14 border-slate-200 bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 font-semibold rounded-xl transition-all">
                    <SkipForward className="h-4 w-4 mr-2" /> Skip
                  </Button>
                  <Button onClick={completeToken} disabled={!currentToken || actionLoading} variant="outline"
                    className="h-14 border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-semibold rounded-xl transition-all">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Done
                  </Button>
                </div>

                {/* Transfer button */}
                {currentToken && (
                  <Button onClick={() => setTransferOpen(true)} variant="outline"
                    className="mt-4 w-full h-12 border-slate-200 bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 font-bold rounded-xl transition-colors">
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer to Another Service Queue
                  </Button>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6 lg:space-y-8">
              {/* Waiting Queue */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900">Waiting Queue</h3>
                  <span className="inline-flex py-1 px-3 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                    {waitingTokens.length} waiting
                  </span>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {waitingTokens.map((t, idx) => (
                    <div key={t.id} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-white hover:border-violet-200 hover:shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white border border-slate-100 text-xs font-bold text-slate-400 group-hover:text-violet-600 group-hover:bg-violet-50 transition-colors">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold font-display text-slate-900 leading-none block">{t.token_number}</span>
                          <span className="text-xs font-medium text-slate-500">{t.services?.name}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {t.priority_level && t.priority_level !== "normal" ? (
                          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            t.priority_level === "vip" ? "bg-amber-100 text-amber-700" :
                            t.priority_level === "elderly" ? "bg-teal-100 text-teal-700" :
                            "bg-red-100 text-red-700"
                          }`}>{t.priority_level}</span>
                        ) : (
                          <div className="h-4"></div>
                        )}
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span className="text-[10px] font-medium">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {waitingTokens.length === 0 && (
                    <div className="py-10 text-center flex flex-col items-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">Queue is empty 🎉</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Log */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-slate-400" />
                  Activity Log
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {actionLogs.length > 0 ? actionLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ${
                        log.action === "Called" ? "bg-emerald-500" :
                        log.action === "Completed" ? "bg-blue-500" :
                        log.action === "Skipped" ? "bg-amber-500" :
                        "bg-violet-500"
                      }`} />
                      <div className="min-w-0 flex-1 flex justify-between items-baseline">
                        <p className="text-sm">
                          <span className="font-semibold text-slate-600">{log.action}</span>{" "}
                          <span className="font-bold text-slate-900">{log.token}</span>
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">{log.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm font-medium text-slate-500 py-4 text-center">No actions recorded yet</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Transfer Dialog */}
      {currentToken && (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          token={currentToken}
          services={services}
          organizationId={organizationId || ""}
          onTransferred={() => { fetchData(); setTransferOpen(false); logAction("Transferred", currentToken.token_number); }}
        />
      )}
    </div>
  );
}
