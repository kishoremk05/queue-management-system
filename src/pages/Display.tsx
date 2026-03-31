import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { announceMessage, announceNextInQueue, announceToken, playChime, unlockAudio } from "@/utils/tts";
import {
  Monitor,
  BadgeInfo,
  Volume2,
  VolumeX,
} from "lucide-react";

export default function Display() {
  const { orgId } = useParams<{ orgId: string }>();
  const [tokens, setTokens] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [orgName, setOrgName] = useState("Smart Queue");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [lastAnnouncedToken, setLastAnnouncedToken] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animatingToken, setAnimatingToken] = useState<string>("");

  // Clock timer
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    const [tkn, ctr, org] = await Promise.all([
      supabase.from("tokens").select("*, services(name, prefix), counters(counter_number)").eq("organization_id", orgId).in("status", ["serving", "waiting"]).order("created_at", { ascending: true }),
      supabase.from("counters").select("*, services(name)").eq("organization_id", orgId),
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    ]);
    setTokens(tkn.data || []);
    setCounters(ctr.data || []);
    setOrgName(org.data?.name || "Smart Queue");
  }, [orgId]);

  useEffect(() => {
    if (!hasStarted) return;
    if (!("speechSynthesis" in window)) return;
    const handleVoices = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.onvoiceschanged = handleVoices;
    handleVoices();
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [hasStarted]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription with audio
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("display-tokens")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tokens", filter: `organization_id=eq.${orgId}` }, async (payload) => {
        const updatedToken = payload.new as any;
        if (updatedToken.status === "serving" && updatedToken.token_number !== lastAnnouncedToken) {
          const { data: counter } = updatedToken.counter_id
            ? await supabase.from("counters").select("counter_number").eq("id", updatedToken.counter_id).maybeSingle()
            : { data: null };

          if (audioEnabled) {
            playChime();
            setTimeout(() => {
              announceToken(updatedToken.token_number, counter?.counter_number);
            }, 1000);
          }
          setLastAnnouncedToken(updatedToken.token_number);
          setAnimatingToken(updatedToken.token_number);
          setTimeout(() => setAnimatingToken(""), 3000);
        }
        fetchData();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tokens", filter: `organization_id=eq.${orgId}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, audioEnabled, lastAnnouncedToken, fetchData]);

  const servingTokens = tokens.filter((t) => t.status === "serving");
  const waitingTokens = tokens.filter((t) => t.status === "waiting");
  const currentServingToken = servingTokens[0] ?? null;
  const nextWaitingToken = waitingTokens[0] ?? null;
  const nextWaitingPosition = nextWaitingToken ? waitingTokens.findIndex((token) => token.id === nextWaitingToken.id) + 1 : null;
  const currentServingCounter = currentServingToken
    ? counters.find((counter) => counter.id === currentServingToken.counter_id)
    : null;
  const previewToken = currentServingToken ?? nextWaitingToken;
  const previewTitle = currentServingToken ? "Current Call" : "Next in Queue";
  const previewBadge = currentServingToken
    ? currentServingToken.priority_level
    : nextWaitingToken
      ? "waiting"
      : "waiting";

  // Organize by counter
  const counterMap = new Map<number, any>();
  counters.forEach((c) => {
    const serving = servingTokens.find((t) => t.counter_id === c.id);
    counterMap.set(c.counter_number, {
      counter: c,
      token: serving,
    });
  });

  const handleStartDisplay = () => {
    unlockAudio();
    setHasStarted(true);
  };

  const handleTestAudio = () => {
    unlockAudio();
    if (audioEnabled) {
      playChime();
      setTimeout(() => {
        if (nextWaitingToken) {
          announceNextInQueue(nextWaitingToken.token_number, nextWaitingPosition ?? undefined);
        } else {
          announceMessage("Audio test successful. Queue announcements are now active.");
        }
      }, 600);
    }
  };

  if (!hasStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white flex-col gap-8 p-6">
        <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-2xl shadow-violet-600/50">
          <Monitor className="h-12 w-12 text-white" />
        </div>
        <div className="text-center max-w-lg">
          <h1 className="text-4xl font-bold font-display mb-4 tracking-tight">Ready to start display</h1>
          <p className="text-slate-400 text-lg mb-8">
            Browsers require a user interaction to allow audio playback. Please click the button below to start the display and enable queue announcements.
          </p>
          <button
            onClick={handleStartDisplay}
            className="h-16 px-12 rounded-full bg-white text-slate-900 text-xl font-bold hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-xl"
          >
            Start Display Screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-br from-violet-100/50 via-blue-50/50 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8 lg:px-10 lg:py-5">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-500/20 shrink-0">
              <Monitor className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold font-display tracking-tight text-slate-900 truncate">{orgName}</h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-[0.2em] sm:tracking-widest">Queue Display System</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {nextWaitingToken && (
              <button
                onClick={() => announceNextInQueue(nextWaitingToken.token_number, nextWaitingPosition ?? undefined)}
                className="inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all shadow-sm bg-slate-50 text-slate-700 border border-slate-200"
              >
                Announce Next
              </button>
            )}

            <button
              onClick={handleTestAudio}
              className="inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all shadow-sm bg-violet-50 text-violet-700 border border-violet-200"
            >
              <BadgeInfo className="h-4 w-4" />
              Test Audio
            </button>

            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                audioEnabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {audioEnabled ? "Audio On" : "Audio Off"}
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight tabular-nums font-display drop-shadow-sm">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-[11px] lg:text-xs font-medium text-slate-500">
                {currentTime.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Hero Now Serving */}
        <section className="mb-8 lg:mb-10">
          <div className="flex items-center gap-3 mb-4 lg:mb-6">
            <h2 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-[0.24em] sm:tracking-widest">Now Serving</h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className={`relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border bg-white shadow-xl shadow-slate-200/60 transition-all duration-500 ${currentServingToken ? "border-emerald-200" : "border-slate-200"}`}>
              {previewToken && animatingToken === previewToken.token_number && (
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] animate-pulse-glow pointer-events-none border-2 border-emerald-400/40" />
              )}

              <div className="relative p-5 sm:p-6 lg:p-8 xl:p-10 min-h-[240px] sm:min-h-[280px] flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.25em] sm:tracking-widest mb-2">{previewTitle}</p>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold capitalize ${
                      currentServingToken
                        ? currentServingToken.priority_level === "urgent" ? "bg-red-100 text-red-700"
                          : currentServingToken.priority_level === "vip" ? "bg-amber-100 text-amber-700"
                          : currentServingToken.priority_level === "elderly" ? "bg-teal-100 text-teal-700"
                          : "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {currentServingToken ? currentServingToken.priority_level || "Normal" : nextWaitingToken ? "Waiting" : "No active token"}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.24em] sm:tracking-widest mb-1">Counter</p>
                            <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-violet-600 font-display leading-none">
                              {currentServingToken ? currentServingCounter?.counter_number || "Unassigned" : "--"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-6 sm:py-8 lg:py-10">
                  {previewToken ? (
                    <>
                      <div className={`text-[4.5rem] sm:text-[6rem] lg:text-[8rem] leading-none font-black tracking-tighter font-display mb-3 sm:mb-4 transition-colors ${animatingToken === previewToken.token_number ? "text-emerald-600" : "text-slate-900"}`}>
                        {previewToken.token_number}
                      </div>
                      <p className="text-sm sm:text-lg lg:text-2xl font-medium text-slate-500 text-center max-w-2xl">
                        {previewToken.services?.name || "Service"}
                      </p>
                      {!currentServingToken && nextWaitingToken && (
                        <p className="mt-2 text-xs sm:text-sm font-semibold text-violet-600 text-center">
                          Queue position {nextWaitingPosition}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-5xl sm:text-7xl lg:text-8xl font-black text-slate-300 tracking-tight font-display mb-2">--</div>
                      <p className="text-sm sm:text-base lg:text-xl font-medium text-slate-500 text-center">No one is currently being served. Call the next token from staff to begin.</p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.24em]">Queue</p>
                    <p className="mt-1 text-xl font-black text-slate-900 font-display">{waitingTokens.length} waiting</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.24em]">Next</p>
                    <p className="mt-1 text-xl font-black text-slate-900 font-display truncate">{nextWaitingToken?.token_number || "--"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 p-5 sm:p-6 lg:p-8">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.24em] sm:tracking-widest mb-4">Active Counters</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
                {Array.from(counterMap.entries())
                  .sort(([a], [b]) => a - b)
                  .slice(0, 4)
                  .map(([counterNum, { counter, token }]) => (
                    <div
                      key={counterNum}
                      className={`rounded-2xl border p-4 transition-all duration-300 ${
                        token
                          ? animatingToken === token.token_number
                            ? "border-emerald-300 bg-emerald-50 shadow-lg shadow-emerald-500/10"
                            : "border-slate-200 bg-slate-50"
                          : "border-dashed border-slate-200 bg-slate-50/70 opacity-75"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.24em]">Counter {counterNum}</p>
                          <p className="mt-1 text-sm sm:text-base font-semibold text-slate-700 truncate">{counter.services?.name || "Service"}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg sm:text-xl font-black font-display leading-none ${token ? "text-slate-900" : "text-slate-300"}`}>
                            {token?.token_number || "--"}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
                            {token ? (token.priority_level || "normal") : "waiting"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        {/* Up Next Strip */}
        {waitingTokens.length > 0 && (
          <div className="animate-fade-up">
            <div className="flex items-center gap-3 mb-4 lg:mb-6">
              <h2 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-[0.24em] sm:tracking-widest">Waiting Queue</h2>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 bg-white p-4 sm:p-5 lg:p-6 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
              
              <div className="flex items-center gap-3 overflow-x-auto pb-2 -mb-2 no-scrollbar px-1 sm:px-2">
                <div className="shrink-0 flex items-center gap-2 mr-3 sm:mr-4 bg-slate-50 px-3 sm:px-4 py-2 rounded-2xl border border-slate-100">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-600">{waitingTokens.length} Waiting</span>
                </div>

                {waitingTokens.map((token, index) => (
                  <div
                    key={token.id}
                    className="shrink-0 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-3 shadow-sm hover:border-violet-300 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-bold text-slate-400">#{index + 1}</span>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <p className="text-lg sm:text-xl font-bold font-display leading-none text-slate-900">{token.token_number}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                          token.priority_level === "urgent" ? "text-red-500" :
                          token.priority_level === "vip" ? "text-amber-500" :
                          token.priority_level === "elderly" ? "text-teal-500" :
                          "text-blue-500"
                        }`}>
                          {token.priority_level || "Normal"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-24">{token.services?.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
