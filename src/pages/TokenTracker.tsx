import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  SkipForward,
  Users,
} from "lucide-react";

const statusTimeline = [
  { key: "waiting", label: "In Queue", icon: Clock, color: "bg-amber-100 text-amber-600", activeBg: "bg-amber-600 text-white" },
  { key: "serving", label: "Being Served", icon: Users, color: "bg-blue-100 text-blue-600", activeBg: "bg-blue-600 text-white" },
  { key: "done", label: "Completed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600", activeBg: "bg-emerald-600 text-white" },
];

export default function TokenTracker() {
  const { orgId, tokenNumber } = useParams<{ orgId: string; tokenNumber: string }>();
  const [token, setToken] = useState<any>(null);
  const [orgName, setOrgName] = useState("Smart Queue");
  const [position, setPosition] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToken = async () => {
    if (!orgId || !tokenNumber) return;
    const [tokenRes, orgRes] = await Promise.all([
      supabase.from("tokens").select("*, services(name, prefix), counters(counter_number)").eq("organization_id", orgId).eq("token_number", tokenNumber).maybeSingle(),
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    ]);
    
    setToken(tokenRes.data);
    setOrgName(orgRes.data?.name || "Smart Queue");

    // Calculate position in queue
    if (tokenRes.data && tokenRes.data.status === "waiting") {
      const { data: allWaiting } = await supabase
        .from("tokens")
        .select("id, created_at, priority_rank")
        .eq("organization_id", orgId)
        .eq("service_id", tokenRes.data.service_id)
        .eq("status", "waiting")
        .order("priority_rank", { ascending: true })
        .order("created_at", { ascending: true });

      if (allWaiting) {
        const idx = allWaiting.findIndex((t: any) => t.id === tokenRes.data.id);
        setPosition(idx >= 0 ? idx + 1 : null);
        // Rough estimate: 4 min per person
        setEstimatedWait(idx >= 0 ? (idx + 1) * 4 : null);
      }
    } else {
      setPosition(null);
      setEstimatedWait(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchToken(); }, [orgId, tokenNumber]);

  // Real-time subscription
  useEffect(() => {
    if (!orgId || !tokenNumber) return;
    const channel = supabase
      .channel("track-token")
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens", filter: `organization_id=eq.${orgId}` }, () => {
        fetchToken();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, tokenNumber]);

  const getStatusIndex = () => {
    if (!token) return -1;
    if (token.status === "skipped") return -1;
    return statusTimeline.findIndex((s) => s.key === token.status);
  };

  const statusIdx = getStatusIndex();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="h-10 w-10 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold font-display mb-3">Token Not Found</h1>
          <p className="text-slate-500 mb-8">Token {tokenNumber} was not found for this organization.</p>
          <Link to="/" className="inline-flex items-center text-sm font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 px-5 py-2.5 rounded-full transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-br from-violet-100 via-blue-50 to-transparent blur-3xl opacity-60" />
      </div>

      <main className="mx-auto max-w-md px-6 py-8 md:py-12 space-y-6">
        {/* Header */}
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 shadow-sm mb-6">
            <MapPin className="h-4 w-4 text-violet-600" />
            <span className="font-medium">{orgName}</span>
          </div>
          <h1 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Your Token</h1>
          <p className="text-[5rem] leading-none font-bold text-slate-900 tracking-tighter font-display animate-pulse-once drop-shadow-sm">
            {token.token_number}
          </p>
          <p className="mt-4 text-lg font-medium text-slate-500">{token.services?.name}</p>
        </div>

        {/* Status Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xl shadow-slate-200/50 animate-fade-up relative overflow-hidden" style={{ animationDelay: "100ms" }}>
          {token.status === "skipped" ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-500">
                <SkipForward className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Token Skipped</h2>
              <p className="text-slate-500">Please contact staff for assistance.</p>
            </div>
          ) : token.status === "done" ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Service Complete</h2>
              <p className="text-slate-500">Thank you for visiting {orgName}!</p>
            </div>
          ) : (
            <>
              {/* Position in Queue */}
              {token.status === "waiting" && position !== null && (
                <div className="text-center mb-8">
                  <div className="relative mx-auto w-32 h-32">
                    <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" className="stroke-slate-100" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke="url(#progressGradient)" strokeWidth="8"
                        strokeDasharray={`${Math.max(10, 100 - (position - 1) * 15)} 264`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="progressGradient" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-4xl font-bold text-slate-900 leading-none mb-1">{position}</p>
                      <p className="text-[10px] font-bold text-slate-400 text-slate-400 uppercase tracking-wider">in line</p>
                    </div>
                  </div>
                  {estimatedWait !== null && (
                    <div className="mt-5 text-center">
                      <div className="inline-flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-100 px-5 py-2.5 text-sm font-semibold text-violet-700 shadow-sm">
                        <Clock className="h-4 w-4" />
                        ~{estimatedWait} min estimated wait
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Serving info */}
              {token.status === "serving" && (
                <div className="text-center mb-8 animate-scale-in">
                  <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-violet-600 text-white shadow-xl shadow-violet-600/30 animate-pulse-glow">
                    <Bell className="h-10 w-10" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">It's Your Turn!</h2>
                  {token.counters?.counter_number && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-slate-500 font-medium">Please proceed to</p>
                      <p className="text-2xl font-black text-violet-600 mt-1">Counter {token.counters.counter_number}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Status Timeline */}
          <div className="mt-8 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between">
              {statusTimeline.map((step, idx) => {
                const StepIcon = step.icon;
                const isReached = statusIdx >= idx;
                const isCurrent = statusIdx === idx;
                
                return (
                  <div key={step.key} className="flex flex-col items-center relative" style={{ flex: 1 }}>
                    {idx > 0 && (
                      <div className={`absolute top-5 right-1/2 w-full h-1 -translate-y-1/2 rounded-full transition-colors ${
                        statusIdx >= idx ? "bg-violet-500" : "bg-slate-100"
                      }`} />
                    )}
                    <div className={`relative z-10 grid h-10 w-10 place-items-center rounded-full transition-all duration-500 ${
                      isCurrent ? `${step.activeBg} shadow-lg shadow-violet-500/30 scale-110` :
                      isReached ? step.activeBg :
                      "bg-slate-100 text-slate-400"
                    }`}>
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <p className={`mt-3 text-xs font-bold text-center ${isCurrent ? "text-slate-900" : isReached ? "text-slate-700" : "text-slate-400"}`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Token Details */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm animate-fade-up" style={{ animationDelay: "200ms" }}>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Token Details</h3>
          <div className="space-y-4">
            {[
              { label: "Service", value: token.services?.name },
              { label: "Priority", value: token.priority_level || "Normal" },
              { label: "Generated", value: `${new Date(token.created_at).toLocaleDateString()} at ${new Date(token.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
              ...(token.counters?.counter_number ? [{ label: "Counter", value: `Counter ${token.counters.counter_number}` }] : []),
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">{item.label}</span>
                <span className="font-bold text-slate-900 capitalize text-right max-w-[60%] truncate">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live indicator */}
        <div className="text-center pb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-500 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live tracking active
          </span>
        </div>
      </main>
    </div>
  );
}
