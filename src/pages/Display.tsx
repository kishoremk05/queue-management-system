import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { announceMessage, unlockAudio } from "@/utils/tts";
import { startHeartbeat, stopHeartbeat } from "@/utils/deviceHealth";
import {
  ArrowRight,
  Bell,
  Clock,
  Expand,
  Hash,
  Maximize2,
  Monitor,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

const AD_ROTATE_INTERVAL = 8000;

export default function Display() {
  const { orgId } = useParams<{ orgId: string }>();
  const [tokens, setTokens] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [announcedIds, setAnnouncedIds] = useState<Set<string>>(new Set());
  const [currentCallToken, setCurrentCallToken] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const announcedRef = useRef(announcedIds);

  useEffect(() => { announcedRef.current = announcedIds; }, [announcedIds]);

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotate ads
  useEffect(() => {
    const ads: string[] = (orgSettings?.display_ads as string[]) || [];
    if (ads.length > 1) {
      const t = setInterval(() => setAdIndex((p) => (p + 1) % ads.length), AD_ROTATE_INTERVAL);
      return () => clearInterval(t);
    }
  }, [orgSettings]);

  // Device heartbeat
  useEffect(() => {
    if (orgId) {
      startHeartbeat(orgId, "display", `display-${orgId}`);
    }
    return () => stopHeartbeat();
  }, [orgId]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Fetch everything
  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    const [tkn, svc, ctr, org] = await Promise.all([
      supabase.from("tokens").select("*, services(name, prefix), counters(counter_number)").eq("organization_id", orgId).in("status", ["waiting", "serving"]).order("priority_rank").order("created_at"),
      supabase.from("services").select("*").eq("organization_id", orgId),
      supabase.from("counters").select("*, services(name)").eq("organization_id", orgId),
      supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    ]);
    setTokens(tkn.data || []);
    setServices(svc.data || []);
    setCounters(ctr.data || []);
    setOrgSettings(org.data);
  }, [orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time subscription
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`display-tokens-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tokens", filter: `organization_id=eq.${orgId}` }, (payload: any) => {
        fetchAll();
        // TTS for newly serving tokens
        if (payload.eventType === "UPDATE" && payload.new?.status === "serving" && !announcedRef.current.has(payload.new.id)) {
          const tok = payload.new;
          setCurrentCallToken(tok);
          if (!muted) {
            const counterNum = tok.counter_id
              ? counters.find((c) => c.id === tok.counter_id)?.counter_number || ""
              : "";
            const msg = counterNum
              ? `Token ${tok.token_number}, please proceed to counter ${counterNum}`
              : `Token ${tok.token_number}, please proceed to the counter`;
            announceMessage(msg);
          }
          setAnnouncedIds((prev) => new Set(prev).add(tok.id));
          setTimeout(() => setCurrentCallToken(null), 10000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, muted, counters, fetchAll]);

  const servingTokens = tokens.filter((t) => t.status === "serving");
  const waitingTokens = tokens.filter((t) => t.status === "waiting");
  const orgName = orgSettings?.name || "Smart Queue";
  const primaryColor = orgSettings?.primary_color || "#7c3aed";
  const logoUrl = orgSettings?.logo_url;
  const displayAds: string[] = (orgSettings?.display_ads as string[]) || [];

  // Get waiting count per service
  const waitingByService = services.map((s) => ({
    ...s,
    waitCount: waitingTokens.filter((t) => t.service_id === s.id).length,
  }));

  // Next tokens preview (top 3 waiting)
  const nextUp = waitingTokens.slice(0, 5);

  return (
    <div ref={containerRef} className="min-h-[100dvh] bg-slate-950 text-white font-sans flex flex-col overflow-hidden relative select-none" onClick={() => unlockAudio()}>
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/30 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      </div>

      {/* Header */}
      <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt={orgName} className="h-12 w-12 rounded-2xl object-cover shadow-xl" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-2xl shadow-xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
              <span className="text-xl font-black text-white">Q</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black font-display text-white tracking-tight">{orgName}</h1>
            <p className="text-sm font-bold text-white/50 uppercase tracking-widest">Queue Display</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Current time */}
          <div className="flex items-center gap-2 text-white/60 text-lg font-mono font-bold">
            <Clock className="h-5 w-5" />
            {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>

          {/* Mute toggle */}
          <button onClick={() => { setMuted(!muted); if (muted) { unlockAudio(); } }} className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center transition-all">
            {muted ? <VolumeX className="h-5 w-5 text-white/60" /> : <Volume2 className="h-5 w-5 text-white" />}
          </button>

          {/* Fullscreen toggle */}
          <button onClick={toggleFullscreen} className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center transition-all">
            <Maximize2 className="h-5 w-5 text-white/60" />
          </button>
        </div>
      </header>

      {/* Current Call Banner */}
      {currentCallToken && (
        <div className="animate-scale-in shrink-0 mx-6 mt-4 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 p-6 flex items-center justify-between shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 animate-pulse-slow" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur-xl">
              <Bell className="h-8 w-8 text-white animate-bounce" />
            </div>
            <div>
              <p className="text-lg font-bold text-white/80 uppercase tracking-widest">Now Calling</p>
              <p className="text-5xl font-black font-display text-white tracking-tight">{currentCallToken.token_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative z-10 bg-white/10 backdrop-blur-xl rounded-2xl px-6 py-4">
            <ArrowRight className="h-6 w-6 text-white" />
            <p className="text-2xl font-black text-white">
              Counter {counters.find((c) => c.id === currentCallToken.counter_id)?.counter_number || "—"}
            </p>
          </div>
        </div>
      )}

      {/* Main Content: Split Layout */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-6 min-h-0">
        {/* Left: Now Serving at Counters */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white/80 uppercase tracking-widest flex items-center gap-3">
              <Monitor className="h-6 w-6 text-violet-400" /> Now Serving
            </h2>
            <span className="text-sm font-bold text-white/40 bg-white/5 rounded-full px-4 py-1.5">{servingTokens.length} active</span>
          </div>

          {servingTokens.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr flex-1">
              {servingTokens.map((tok) => (
                <div key={tok.id} className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-5xl sm:text-6xl font-black font-display text-white tracking-tighter mb-3 relative z-10">{tok.token_number}</p>
                  <p className="text-sm font-bold text-violet-400 uppercase tracking-widest mb-2 relative z-10">{tok.services?.name}</p>
                  <div className="flex items-center gap-2 bg-violet-500/20 backdrop-blur-xl text-violet-300 rounded-full px-4 py-2 font-bold text-sm relative z-10">
                    <Hash className="h-4 w-4" />
                    Counter {tok.counters?.counter_number || "—"}
                  </div>
                  {tok.priority_level && tok.priority_level !== "normal" && (
                    <span className={`mt-3 inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider relative z-10 ${
                      tok.priority_level === "vip" ? "bg-amber-500/20 text-amber-400" :
                      tok.priority_level === "elderly" ? "bg-teal-500/20 text-teal-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {tok.priority_level}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid place-items-center rounded-3xl border border-white/5 bg-white/[2%]">
              <div className="text-center text-white/30 space-y-3">
                <Monitor className="h-12 w-12 mx-auto opacity-50" />
                <p className="text-lg font-bold">No tokens currently being served</p>
              </div>
            </div>
          )}
        </section>

        {/* Right Sidebar: Queue Info */}
        <aside className="lg:w-[380px] xl:w-[420px] flex flex-col gap-4 shrink-0">
          {/* Next Up */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex-shrink-0">
            <h3 className="text-sm font-black text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" /> Next Up
            </h3>
            {nextUp.length > 0 ? (
              <div className="space-y-2">
                {nextUp.map((tok, idx) => (
                  <div key={tok.id} className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all ${
                    idx === 0 ? "bg-violet-500/15 border border-violet-500/20" : "bg-white/[3%] border border-white/5"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-black font-display ${idx === 0 ? "text-violet-300" : "text-white/70"}`}>{tok.token_number}</span>
                      {tok.priority_level && tok.priority_level !== "normal" && (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          tok.priority_level === "vip" ? "bg-amber-500/20 text-amber-400" :
                          tok.priority_level === "elderly" ? "bg-teal-500/20 text-teal-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>{tok.priority_level}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white/40">{tok.services?.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-white/30 text-center py-4">Queue is empty</p>
            )}
          </div>

          {/* Waiting Count by Service */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex-shrink-0">
            <h3 className="text-sm font-black text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" /> Waiting by Service
            </h3>
            <div className="space-y-2">
              {waitingByService.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl bg-white/[3%] border border-white/5 px-4 py-3">
                  <span className="text-sm font-bold text-white/70">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">{s.waitCount}</span>
                    <span className="text-xs text-white/40">waiting</span>
                  </div>
                </div>
              ))}
              {waitingByService.length === 0 && (
                <p className="text-sm font-medium text-white/30 text-center py-3">No services</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-violet-500/10 border border-violet-500/10 p-4 text-center">
                <p className="text-3xl font-black font-display text-violet-300">{servingTokens.length}</p>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider mt-1">Serving</p>
              </div>
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/10 p-4 text-center">
                <p className="text-3xl font-black font-display text-amber-300">{waitingTokens.length}</p>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider mt-1">Waiting</p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom Ad/Info Bar */}
      {displayAds.length > 0 && (
        <footer className="shrink-0 border-t border-white/5 bg-black/30 backdrop-blur-xl px-6 py-3">
          <div className="flex items-center gap-4 overflow-hidden">
            <span className="shrink-0 text-xs font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">Info</span>
            <p className="text-sm font-medium text-white/60 truncate animate-fade-up" key={adIndex}>
              {displayAds[adIndex]}
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
