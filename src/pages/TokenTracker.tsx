import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { predictWaitTime, quickEstimate } from "@/utils/waitTimePredictor";
import {
  requestNotificationPermission,
  sendBrowserNotification,
  vibrateDevice,
  isBrowserNotificationsSupported,
} from "@/utils/notifications";
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Clock,
  Hash,
  RefreshCw,
  Share2,
  Smartphone,
  Users,
  XCircle,
} from "lucide-react";

export default function TokenTracker() {
  const { orgId, tokenNumber } = useParams<{ orgId: string; tokenNumber: string }>();

  const [token, setToken] = useState<any>(null);
  const [position, setPosition] = useState<number>(0);
  const [estimatedWait, setEstimatedWait] = useState<number>(0);
  const [waitConfidence, setWaitConfidence] = useState<"high" | "medium" | "low">("low");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastStatus, setLastStatus] = useState<string>("");
  const previousPositionRef = useRef(0);

  const fetchToken = async (showRefresh = false) => {
    if (!orgId || !tokenNumber) return;
    if (showRefresh) setRefreshing(true);

    try {
      // Fetch token
      const { data: tokenData } = await supabase
        .from("tokens")
        .select("*, services(name, prefix, estimated_duration_minutes), counters(counter_number)")
        .eq("organization_id", orgId)
        .eq("token_number", tokenNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenData) {
        setToken(null);
        setLoading(false);
        return;
      }

      setToken(tokenData);

      // Fetch org name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      setOrgName(org?.name || "Smart Queue");

      // Calculate position if waiting
      if (tokenData.status === "waiting") {
        const { data: allWaiting } = await supabase
          .from("tokens")
          .select("id, priority_rank, created_at")
          .eq("organization_id", orgId)
          .eq("service_id", tokenData.service_id)
          .eq("status", "waiting")
          .order("priority_rank")
          .order("created_at");

        const pos = (allWaiting || []).findIndex((t: any) => t.id === tokenData.id) + 1;
        setPosition(pos);
        previousPositionRef.current = pos;

        // AI wait time prediction
        const prediction = await predictWaitTime(orgId, tokenData.service_id, pos);
        setEstimatedWait(prediction.estimatedMinutes);
        setWaitConfidence(prediction.confidence);
      } else {
        setPosition(0);
        setEstimatedWait(0);
      }

      // Handle status change notifications
      if (lastStatus && lastStatus !== tokenData.status) {
        if (tokenData.status === "serving") {
          sendBrowserNotification(
            "It's Your Turn!",
            `Token ${tokenData.token_number} — please proceed to Counter ${tokenData.counters?.counter_number || ""}`,
            { requireInteraction: true }
          );
          vibrateDevice([200, 100, 200, 100, 200]);
        } else if (tokenData.status === "done") {
          sendBrowserNotification(
            "Visit Complete",
            `Token ${tokenData.token_number} has been marked as complete. Thank you!`
          );
        }
      }
      setLastStatus(tokenData.status);
    } catch (err) {
      console.error("Failed to fetch token:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, [orgId, tokenNumber]);

  // Real-time subscription
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`track-${orgId}-${tokenNumber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens", filter: `organization_id=eq.${orgId}` }, () => {
        fetchToken();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, tokenNumber]);

  // Enable notifications
  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      sendBrowserNotification("Notifications Enabled", "We'll notify you when your turn is near.");
    }
  };

  // Share
  const sharePosition = async () => {
    const url = window.location.href;
    const text = `I'm in the queue at ${orgName}! Token: ${tokenNumber}, Position: #${position}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Queue - ${tokenNumber}`, text, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch {}
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-500">Loading your queue position...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <XCircle className="h-16 w-16 text-slate-300 mx-auto" />
          <h2 className="text-2xl font-black text-slate-900">Token Not Found</h2>
          <p className="text-slate-500 font-medium">The token <span className="font-bold">{tokenNumber}</span> doesn't exist or has expired.</p>
        </div>
      </div>
    );
  }

  const isDone = token.status === "done";
  const isSkipped = token.status === "skipped";
  const isServing = token.status === "serving";
  const isWaiting = token.status === "waiting";

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600">
              <span className="text-sm font-bold text-white">Q</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">{orgName}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Queue Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchToken(true)} className={`h-9 w-9 rounded-xl bg-slate-50 grid place-items-center text-slate-500 ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw className="h-4 w-4" />
            </button>
            {isBrowserNotificationsSupported() && (
              <button onClick={toggleNotifications} className={`h-9 w-9 rounded-xl grid place-items-center ${notificationsEnabled ? "bg-violet-50 text-violet-600" : "bg-slate-50 text-slate-400"}`}>
                {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </button>
            )}
            <button onClick={sharePosition} className="h-9 w-9 rounded-xl bg-slate-50 grid place-items-center text-slate-500">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
        {/* Token Card */}
        <div className="w-full rounded-3xl border-2 border-slate-200 bg-white shadow-lg overflow-hidden">
          {/* Status banner */}
          <div className={`px-6 py-4 text-center ${
            isServing ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" :
            isDone ? "bg-slate-100 text-slate-600" :
            isSkipped ? "bg-red-50 text-red-600" :
            "bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700"
          }`}>
            <p className="text-xs font-black uppercase tracking-widest">
              {isServing ? "🎉 IT'S YOUR TURN!" :
               isDone ? "VISIT COMPLETE" :
               isSkipped ? "TOKEN SKIPPED" :
               "WAITING IN QUEUE"}
            </p>
          </div>

          {/* Token number */}
          <div className="px-6 py-8 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Your Token</p>
            <p className={`text-7xl font-black font-display tracking-tighter leading-none ${
              isServing ? "text-emerald-600" :
              isDone || isSkipped ? "text-slate-400" :
              "text-slate-900"
            }`}>{token.token_number}</p>
            <p className="text-base font-bold text-violet-600 mt-3">{token.services?.name}</p>
            {token.priority_level && token.priority_level !== "normal" && (
              <span className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-black uppercase ${
                token.priority_level === "vip" ? "bg-amber-100 text-amber-700" :
                token.priority_level === "elderly" ? "bg-teal-100 text-teal-700" :
                "bg-red-100 text-red-700"
              }`}>{token.priority_level}</span>
            )}
          </div>

          {/* Position & Wait Time (only when waiting) */}
          {isWaiting && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 text-center">
                  <p className="text-xs font-black text-violet-500 uppercase tracking-widest mb-1">Position</p>
                  <p className="text-4xl font-black font-display text-violet-700">
                    #{position}
                  </p>
                  <p className="text-xs font-bold text-violet-400 mt-1">in queue</p>
                </div>
                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center">
                  <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">Est. Wait</p>
                  <p className="text-4xl font-black font-display text-blue-700">
                    {estimatedWait}
                  </p>
                  <p className="text-xs font-bold text-blue-400 mt-1">
                    min{waitConfidence !== "low" && ` (${waitConfidence})`}
                  </p>
                </div>
              </div>
              
              {/* Progress hint */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-xs font-medium text-slate-500">
                  {position <= 1
                    ? "🔥 You're next! Get ready!"
                    : position <= 3
                    ? "⏳ Almost there! Stay nearby."
                    : "📱 We'll update your position in real-time."}
                </p>
              </div>
            </div>
          )}

          {/* Serving state */}
          {isServing && (
            <div className="px-6 pb-6">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-lg font-black text-emerald-800">Proceed to Counter</p>
                <p className="text-4xl font-black font-display text-emerald-700 mt-2">
                  {token.counters?.counter_number || "—"}
                </p>
              </div>
            </div>
          )}

          {/* Done state */}
          {isDone && (
            <div className="px-6 pb-6 text-center">
              <Check className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-slate-700">Your visit is complete. Thank you!</p>
            </div>
          )}

          {/* Skipped state */}
          {isSkipped && (
            <div className="px-6 pb-6 text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-slate-700">Your token was skipped.</p>
              <p className="text-sm text-slate-500 mt-1">Please visit the counter or get a new token.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="w-full mt-6 space-y-3">
          {isWaiting && (
            <Link
              to={`/join/${orgId}`}
              className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50"
            >
              <Smartphone className="h-4 w-4" /> Join Another Queue
            </Link>
          )}
          <p className="text-xs text-slate-400 text-center font-medium">
            This page updates automatically. Keep it open to see your position.
          </p>
        </div>
      </main>
    </div>
  );
}
