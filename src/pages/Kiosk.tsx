import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Heart,
  Printer,
  ScanLine,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";

const IDLE_TIMEOUT = 45000;

const priorityOptions = [
  { value: "normal", label: "Normal", icon: Users, color: "bg-blue-50 text-blue-600", activeColor: "bg-blue-600 text-white", borderColor: "border-blue-100", activeBorder: "border-blue-600", description: "Standard Queue" },
  { value: "elderly", label: "Elderly", icon: Heart, color: "bg-teal-50 text-teal-600", activeColor: "bg-teal-600 text-white", borderColor: "border-teal-100", activeBorder: "border-teal-600", description: "Senior Priority" },
  { value: "vip", label: "VIP", icon: Crown, color: "bg-amber-50 text-amber-600", activeColor: "bg-amber-500 text-white", borderColor: "border-amber-100", activeBorder: "border-amber-500", description: "VIP Access" },
  { value: "urgent", label: "Urgent", icon: Zap, color: "bg-red-50 text-red-600", activeColor: "bg-red-600 text-white", borderColor: "border-red-100", activeBorder: "border-red-600", description: "Emergency" },
];

export default function Kiosk() {
  const { orgId } = useParams<{ orgId: string }>();
  const [services, setServices] = useState<any[]>([]);
  const [step, setStep] = useState<"idle" | "services" | "details" | "priority" | "ticket">("idle");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedPriority, setSelectedPriority] = useState("normal");
  const [generatedToken, setGeneratedToken] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [visitReason, setVisitReason] = useState("");
  const idleTimerRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!orgId) return;
      const [svc, org] = await Promise.all([
        supabase.from("services").select("*").eq("organization_id", orgId),
        supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      ]);
      setServices(svc.data || []);
      setOrgName(org.data?.name || "Smart Queue");
    };
    fetchData();
  }, [orgId]);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (step === "ticket") {
      // Shorter timeout after ticket is generated
      idleTimerRef.current = setTimeout(() => {
        handleNewToken();
      }, 15000);
    } else {
      idleTimerRef.current = setTimeout(() => {
        handleNewToken();
      }, IDLE_TIMEOUT);
    }
  };

  useEffect(() => {
    if (step !== "idle") resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [step]);

  const generateToken = async () => {
    if (!selectedService || !orgId) return;
    setLoading(true);
    try {
      let tokenNumber: string | null = null;

      // Try the RPC function first
      const { data: rpcData, error: rpcError } = await supabase.rpc("generate_token_with_priority", {
        _service_id: selectedService.id,
        _org_id: orgId,
        _priority_level: selectedPriority,
      });

      if (!rpcError && rpcData) {
        tokenNumber = rpcData as string;
      } else {
        console.warn("RPC fallback:", rpcError?.message);
        const prefix = selectedService.prefix || selectedService.name?.charAt(0)?.toUpperCase() || "T";
        const today = new Date().toISOString().split("T")[0];
        
        const { count } = await supabase
          .from("tokens")
          .select("*", { count: "exact", head: true })
          .eq("service_id", selectedService.id)
          .gte("created_at", today);

        const num = (count || 0) + 1;
        tokenNumber = `${prefix}${String(num).padStart(3, "0")}`;

        const priorityRank = selectedPriority === "urgent" ? 1 : selectedPriority === "vip" ? 2 : selectedPriority === "elderly" ? 3 : 4;

        const { error: insertError } = await supabase.from("tokens").insert({
          organization_id: orgId,
          service_id: selectedService.id,
          token_number: tokenNumber,
          status: "waiting",
          priority_level: selectedPriority,
          priority_rank: priorityRank,
        });
        if (insertError) throw insertError;
      }

      // Fetch the full token
      const { data: tokenData } = await supabase
        .from("tokens")
        .select("*, services(name, prefix)")
        .eq("organization_id", orgId)
        .eq("token_number", tokenNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setGeneratedToken(tokenData);
      setStep("ticket");
      toast.success("Token generated successfully!");

      if (tokenData?.id) {
        await supabase.from("tokens").update({
          customer_name: customerName || null,
          visit_reason: visitReason || null,
        } as any).eq("id", tokenData.id);
      }
      
      // Auto-print option could go here if configured
      // setTimeout(() => window.print(), 500);
      
    } catch (err: any) {
      toast.error(err.message || "Failed to generate token");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!generatedToken) return;
    window.print();
  };

  const handleNewToken = () => {
    setStep("idle");
    setSelectedService(null);
    setSelectedPriority("normal");
    setGeneratedToken(null);
    setCustomerName("");
    setVisitReason("");
  };

  const trackingUrl = generatedToken
    ? `${window.location.origin}/track/${orgId}/${generatedToken.token_number}`
    : "";

  // ─── Idle Screen ───
  if (step === "idle") {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center bg-white text-slate-900 cursor-pointer overflow-hidden relative"
        onClick={() => setStep("services")}
      >
        {/* Massive animated gradient background */}
        <div className="absolute inset-x-0 -top-[30%] -bottom-[30%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-100 via-white to-white blur-2xl opacity-80 animate-pulse-slow pointer-events-none" />
        
        <div className="relative z-10 text-center animate-fade-up space-y-8 px-6 flex flex-col items-center max-w-2xl mx-auto">
          <div className="mx-auto grid h-28 w-28 sm:h-32 sm:w-32 place-items-center rounded-full bg-white shadow-2xl shadow-violet-500/10 border border-slate-100 animate-float">
            <div className="grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/20 blur-xl animate-pulse-slow"></div>
              <ScanLine className="h-10 w-10 sm:h-12 sm:w-12 text-white relative z-10" />
            </div>
          </div>
          <div className="space-y-6">
            <h2 className="text-lg sm:text-2xl text-slate-500 font-bold tracking-[0.3em] uppercase">Welcome To</h2>
            <h1 className="text-4xl sm:text-6xl font-black font-display tracking-tighter text-slate-900 drop-shadow-sm leading-[0.95]">{orgName}</h1>
          </div>
          <div className="flex items-center justify-center gap-3 text-lg sm:text-2xl text-white font-bold bg-violet-600 px-8 sm:px-10 py-4 sm:py-5 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl shadow-violet-600/30 mx-auto w-fit animate-pulse-once hover:scale-105 transition-transform cursor-pointer">
            Tap screen to start
            <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-root min-h-[100dvh] bg-slate-50 text-slate-900 font-sans flex flex-col" onClick={resetIdleTimer}>
      {/* Background decoration */}
      <div className="kiosk-screen pointer-events-none fixed inset-0 -z-10 bg-white overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-br from-violet-50 via-blue-50/30 to-transparent blur-3xl opacity-80" />
      </div>

      {/* Massive Header for Touchscreens */}
      <header className="kiosk-screen border-b-2 border-slate-100 bg-white/95 backdrop-blur-xl sticky top-0 z-40 px-4 py-3 sm:px-6 lg:px-10 lg:py-4">
        <div className="mx-auto flex w-full items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-xl shadow-violet-500/20">
              <span className="text-lg sm:text-xl font-black text-white">Q</span>
            </div>
            <div>
              <h1 className="font-black font-display text-lg sm:text-xl lg:text-2xl text-slate-900 tracking-tight leading-none">{orgName}</h1>
              <p className="text-[10px] sm:text-xs lg:text-sm text-slate-500 font-bold uppercase tracking-[0.24em] sm:tracking-widest mt-1">Self-Service Kiosk</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {step === "priority" && (
              <Button 
                variant="outline" 
                onClick={() => setStep("services")} 
                className="h-11 sm:h-12 lg:h-14 px-4 sm:px-5 lg:px-7 text-sm sm:text-base lg:text-lg border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-2xl font-bold"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> Go Back
              </Button>
            )}
            <Button 
              variant="ghost" 
              onClick={handleNewToken} 
              className="h-11 sm:h-12 lg:h-14 px-4 sm:px-5 lg:px-7 text-sm sm:text-base lg:text-lg text-red-600 hover:text-red-700 hover:bg-red-50 rounded-2xl font-bold"
            >
              Cancel
            </Button>
          </div>
        </div>
      </header>

      <main className="kiosk-screen flex-1 flex flex-col w-full px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
        {/* Massive Step indicator */}
        <div className="mb-6 lg:mb-10">
          <div className="flex items-center justify-center gap-2 md:gap-3 lg:gap-6 max-w-5xl mx-auto flex-wrap lg:flex-nowrap">
            {["Select Service", "Priority Level", "Your Ticket"].map((label, idx) => {
              const currentIdx = step === "services" ? 0 : step === "priority" ? 1 : 2;
              const isPast = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              
              return (
                <div key={label} className="flex items-center gap-2 md:gap-3 lg:gap-6">
                  {idx > 0 && <div className={`h-1.5 w-5 sm:w-8 md:w-12 lg:w-20 rounded-full transition-colors ${isPast || isCurrent ? "bg-violet-500" : "bg-slate-200"}`} />}
                  <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                    <div className={`grid h-9 w-9 sm:h-10 sm:w-10 lg:h-12 lg:w-12 place-items-center rounded-full text-xs sm:text-sm lg:text-base font-black transition-all ${
                      isPast ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" :
                      isCurrent ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-xl shadow-violet-500/40 scale-110 ring-4 ring-violet-100" :
                      "bg-white border-4 border-slate-200 text-slate-400"
                    }`}>
                      {isPast ? <Check className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className={`text-xs sm:text-sm md:text-base lg:text-lg font-bold hidden sm:inline ${
                      isCurrent ? "text-slate-900" :
                      isPast ? "text-slate-700" :
                      "text-slate-400"
                    }`}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Step: Select Service ─── */}
        {step === "services" && (
          <div className="animate-fade-up max-w-6xl mx-auto w-full flex-1 flex flex-col">
            <div className="text-center mb-6 lg:mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black font-display text-slate-900 tracking-tight leading-tight">What do you need help with?</h2>
              <p className="mt-3 lg:mt-4 text-sm sm:text-base lg:text-xl text-slate-500 font-medium">Please tap on a service below</p>
            </div>
            
            <div className="grid gap-3 sm:gap-4 lg:gap-5 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => { setSelectedService(service); setStep("details"); }}
                  className="group relative flex flex-col items-center justify-center text-center rounded-[1.5rem] sm:rounded-[2rem] border-4 border-slate-100 bg-white p-5 sm:p-6 lg:p-8 transition-all hover:border-violet-500 hover:shadow-2xl hover:shadow-violet-500/20 active:scale-[0.98] min-h-[180px] sm:min-h-[220px]"
                >
                  <div className="grid h-16 w-16 sm:h-20 sm:w-20 lg:h-28 lg:w-28 place-items-center rounded-full bg-slate-50 text-2xl sm:text-3xl lg:text-5xl font-black text-violet-600 font-mono mb-4 sm:mb-5 lg:mb-7 group-hover:bg-violet-50 transition-colors group-hover:scale-110 duration-300">
                    {service.prefix}
                  </div>
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mb-2 group-hover:text-violet-700 transition-colors line-clamp-2">{service.name}</h3>
                  <p className="text-[10px] sm:text-xs lg:text-sm font-bold text-slate-400 mt-auto uppercase tracking-widest group-hover:text-violet-500">Tap to select</p>
                </button>
              ))}
              {services.length === 0 && (
                <div className="col-span-full text-center py-10 sm:py-14 lg:py-16 bg-white rounded-[2rem] sm:rounded-[2.5rem] border-4 border-slate-200 border-dashed">
                  <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-400">No services configured.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step: Customer Details ─── */}
        {step === "details" && (
          <div className="animate-fade-up max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="text-center mb-6 lg:mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black font-display text-slate-900 tracking-tight leading-tight">A few quick questions</h2>
              <p className="mt-3 lg:mt-4 text-sm sm:text-base lg:text-xl text-slate-500 font-medium">This helps staff prepare before your turn</p>
            </div>

            <div className="grid gap-4 lg:gap-5 lg:grid-cols-2 flex-1">
              <div className="rounded-[2rem] border-4 border-slate-100 bg-white p-5 sm:p-6 lg:p-8 space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Your name</p>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter your full name" className="h-14 rounded-2xl border-slate-200 bg-slate-50 text-base font-medium" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Reason for visit</p>
                  <Textarea value={visitReason} onChange={(e) => setVisitReason(e.target.value)} placeholder="Tell us what you need help with" className="min-h-[140px] rounded-2xl border-slate-200 bg-slate-50 text-base font-medium resize-none" />
                </div>
              </div>

              <div className="rounded-[2rem] border-4 border-slate-100 bg-white p-5 sm:p-6 lg:p-8 flex flex-col justify-between gap-5">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500 leading-relaxed">
                  <p className="font-bold text-slate-700 mb-1">Optional details</p>
                  <p>Your name and visit reason help staff prepare before calling your token.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => setStep("services")} variant="outline" className="h-12 sm:h-14 rounded-2xl border-2 border-slate-200 font-bold flex-1">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button onClick={() => setStep("priority")} className="h-12 sm:h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 font-black text-white flex-1">
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step: Priority ─── */}
        {step === "priority" && (
          <div className="animate-fade-up max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="text-center mb-6 lg:mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black font-display text-slate-900 tracking-tight leading-tight">Select Priority Level</h2>
              <div className="mt-4 lg:mt-6 inline-flex items-center gap-2 sm:gap-3 bg-violet-50 px-4 sm:px-5 lg:px-7 py-2 sm:py-2.5 rounded-full border-2 border-violet-100 max-w-full">
                <span className="text-[10px] sm:text-xs lg:text-sm text-slate-500 font-bold uppercase tracking-widest">Service:</span>
                <span className="text-sm sm:text-base lg:text-xl text-violet-700 font-black truncate max-w-[55vw] sm:max-w-none">{selectedService?.name}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 lg:gap-5 md:grid-cols-2 flex-1">
              {priorityOptions.map((opt) => {
                const PriorityIcon = opt.icon;
                const isSelected = selectedPriority === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedPriority(opt.value)}
                    className={`rounded-[1.5rem] sm:rounded-[2rem] border-4 p-4 sm:p-5 lg:p-7 text-left transition-all active:scale-[0.98] flex flex-col sm:flex-row items-center gap-4 sm:gap-5 lg:gap-7 ${
                      isSelected
                        ? `${opt.activeBorder} bg-white shadow-2xl shadow-slate-200/50 scale-[1.02] ring-8 ring-blue-50`
                        : `border-slate-100 bg-white hover:${opt.borderColor} hover:shadow-xl hover:-translate-y-1`
                    }`}
                  >
                    <div className={`grid h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 shrink-0 place-items-center rounded-[1.25rem] sm:rounded-[1.75rem] transition-all ${isSelected ? opt.activeColor : opt.color}`}>
                      <PriorityIcon className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
                    </div>
                    <div className="text-center sm:text-left w-full min-w-0">
                      <h3 className={`text-xl sm:text-2xl lg:text-3xl font-black mb-1 ${isSelected ? "text-slate-900" : "text-slate-700"}`}>{opt.label}</h3>
                      <p className="text-xs sm:text-sm lg:text-lg font-bold text-slate-500">{opt.description}</p>
                    </div>
                    {isSelected && (
                      <div className="sm:ml-auto bg-violet-600 text-white p-2 sm:p-2.5 rounded-full shadow-lg">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center mt-6 lg:mt-12 pb-4 lg:pb-6">
              <Button
                onClick={generateToken}
                disabled={loading}
                className="h-12 sm:h-14 lg:h-16 px-6 sm:px-8 lg:px-12 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-base sm:text-lg lg:text-xl font-black rounded-full shadow-2xl shadow-violet-600/30 hover:shadow-violet-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center gap-4">
                    <span className="h-4 w-4 sm:h-5 sm:w-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                    Confirm & Get Ticket
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step: Ticket ─── */}
        {step === "ticket" && generatedToken && (
          <div className="animate-scale-in max-w-5xl mx-auto w-full flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
            
            {/* Left side: Success Message & Actions for Touchscreen */}
            <div className="flex-1 text-center lg:text-left space-y-5 lg:space-y-6">
              <div className="inline-grid h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 place-items-center rounded-full bg-emerald-100 mb-4 border-8 border-emerald-50">
                <Check className="h-6 w-6 sm:h-7 sm:w-7 lg:h-9 lg:w-9 text-emerald-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black font-display text-slate-900 tracking-tight leading-none">
                You're in line!
              </h2>
              <p className="text-sm sm:text-base lg:text-xl font-medium text-slate-500 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Please take your printed ticket or scan the QR code to track your status on your phone.
              </p>
              
              <div className="pt-2 lg:pt-6 flex flex-col gap-3 lg:gap-4 max-w-md mx-auto lg:mx-0">
                <Button onClick={handlePrint} className="w-full h-12 sm:h-14 lg:h-16 bg-slate-900 text-white text-base sm:text-lg lg:text-xl font-black rounded-3xl shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98]">
                  <Printer className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2" /> Print Ticket
                </Button>
                <Button onClick={handleNewToken} variant="outline" className="w-full h-12 sm:h-14 lg:h-16 border-4 border-slate-200 bg-white text-slate-700 text-sm sm:text-base lg:text-lg font-bold rounded-3xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]">
                  Finish & Get New Token
                </Button>
              </div>
            </div>

            {/* Right side: Digital Preview (Also used for actual thermal printing via CSS) */}
            <div className="flex-shrink-0">
              <div id="print-ticket" className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] p-10 w-[400px] relative overflow-hidden">
                {/* Decorative cutouts to look like a ticket on screen */}
                <div className="absolute -left-6 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-slate-50 border-r-2 border-slate-100 shadow-inner no-print" />
                <div className="absolute -right-6 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-slate-50 border-l-2 border-slate-100 shadow-inner no-print" />
                <div className="absolute top-0 left-0 right-0 h-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTEwIDEwQzEwIDQuNSA1LjUgMCAwIDB2MTBoMjBWMEMxNC41IDAgMTAgNC41IDEwIDEwekIgZmlsbD0iI2Y4ZmFmYyIvPjwvc3ZnPg==')] bg-repeat-x no-print opacity-50" />

                <div className="print-header text-center border-b-4 border-dashed border-slate-200 pb-6 mb-8 mt-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest print:text-black">Welcome to</p>
                  <h2 className="text-3xl font-black text-slate-900 mt-2 print:text-black">{orgName}</h2>
                </div>

                <div className="print-token text-center py-6">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 print:text-black">Your Token Number</p>
                  <p className="text-[7rem] leading-none font-black text-slate-900 tracking-tighter font-display print:text-black">
                    {generatedToken.token_number}
                  </p>
                </div>

                <div className="print-details space-y-4 mb-8 mt-6">
                  <div className="print-row flex justify-between items-center text-lg">
                    <span className="print-label font-bold text-slate-500 print:text-black">Service</span>
                    <span className="print-value font-black text-slate-900 break-words print:text-black">{generatedToken.services?.name}</span>
                  </div>
                  {generatedToken.customer_name && (
                    <div className="print-row flex justify-between items-center text-lg">
                      <span className="print-label font-bold text-slate-500 print:text-black">Name</span>
                      <span className="print-value font-black text-slate-900 break-words print:text-black">{generatedToken.customer_name}</span>
                    </div>
                  )}
                  <div className="print-row flex justify-between items-center text-lg">
                    <span className="print-label font-bold text-slate-500 print:text-black">Priority</span>
                    <span className="print-value font-black text-slate-900 capitalize print:text-black">{generatedToken.priority_level || "Normal"}</span>
                  </div>
                  {generatedToken.visit_reason && (
                    <div className="print-reason pt-2">
                      <p className="font-bold text-slate-500 text-sm uppercase tracking-widest print:text-black">Reason</p>
                      <p className="mt-2 text-base font-medium text-slate-800 print:text-black">{generatedToken.visit_reason}</p>
                    </div>
                  )}
                  <div className="print-row print-meta-row flex justify-between items-center text-sm pt-4 border-t-2 border-slate-100">
                    <span className="print-label font-bold text-slate-500 print:text-black">{new Date(generatedToken.created_at).toLocaleDateString()}</span>
                    <span className="print-value font-bold text-slate-500 print:text-black">{new Date(generatedToken.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {trackingUrl && (
                  <div className="print-qr flex flex-col items-center gap-4 pt-8 border-t-4 border-dashed border-slate-200">
                    <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 print:border-none print:p-0 shadow-sm">
                      <QRCodeSVG
                        value={trackingUrl}
                        size={160}
                        level="M"
                        includeMargin={false}
                        className="print:w-[50mm] print:h-[50mm]"
                      />
                    </div>
                    <p className="text-lg font-bold text-slate-700 w-full text-center leading-snug print:text-black print:text-[10pt]">
                      Scan QR code to track<br/>live queue position
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {step === "ticket" && generatedToken && (
        <div id="print-ticket" className="print-only mx-auto bg-white rounded-[2rem] border-2 border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] p-10 w-[400px] relative overflow-hidden">
          <div className="absolute -left-6 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-slate-50 border-r-2 border-slate-100 shadow-inner no-print" />
          <div className="absolute -right-6 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-slate-50 border-l-2 border-slate-100 shadow-inner no-print" />
          <div className="absolute top-0 left-0 right-0 h-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTEwIDEwQzEwIDQuNSA1LjUgMCAwIDB2MTBoMjBWMEMxNC41IDAgMTAgNC41IDEwIDEwekIgZmlsbD0iI2Y4ZmFmYyIvPjwvc3ZnPg==')] bg-repeat-x opacity-50 no-print" />

          <div className="print-header text-center border-b-4 border-dashed border-slate-200 pb-6 mb-8 mt-2">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Welcome to</p>
            <h2 className="text-3xl font-black text-slate-900 mt-2">{orgName}</h2>
          </div>

          <div className="print-token text-center py-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Your Token Number</p>
            <p className="text-[7rem] leading-none font-black text-slate-900 tracking-tighter font-display">
              {generatedToken.token_number}
            </p>
          </div>

          <div className="print-details space-y-4 mb-8 mt-6">
            <div className="print-row flex justify-between items-center text-lg">
              <span className="print-label font-bold text-slate-500">Service</span>
              <span className="print-value font-black text-slate-900 break-words">{generatedToken.services?.name}</span>
            </div>
            <div className="print-row flex justify-between items-center text-lg">
              <span className="print-label font-bold text-slate-500">Priority</span>
              <span className="print-value font-black text-slate-900 capitalize">{generatedToken.priority_level || "Normal"}</span>
            </div>
            <div className="print-row print-meta-row flex justify-between items-center text-sm pt-4 border-t-2 border-slate-100">
              <span className="print-label font-bold text-slate-500">{new Date(generatedToken.created_at).toLocaleDateString()}</span>
              <span className="print-value font-bold text-slate-500">{new Date(generatedToken.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {trackingUrl && (
            <div className="print-qr flex flex-col items-center gap-4 pt-8 border-t-4 border-dashed border-slate-200">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                <QRCodeSVG value={trackingUrl} size={160} level="M" includeMargin={false} />
              </div>
              <p className="text-lg font-bold text-slate-700 w-full text-center leading-snug">
                Scan QR code to track<br />live queue position
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
