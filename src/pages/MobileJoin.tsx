import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { quickEstimate } from "@/utils/waitTimePredictor";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Heart,
  MessageSquare,
  Phone,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";

const priorityOptions = [
  { value: "normal", label: "Normal", icon: Users, color: "border-blue-200 text-blue-600", active: "border-blue-600 bg-blue-50" },
  { value: "elderly", label: "Elderly", icon: Heart, color: "border-teal-200 text-teal-600", active: "border-teal-600 bg-teal-50" },
  { value: "vip", label: "VIP", icon: Crown, color: "border-amber-200 text-amber-600", active: "border-amber-500 bg-amber-50" },
  { value: "urgent", label: "Urgent", icon: Zap, color: "border-red-200 text-red-600", active: "border-red-600 bg-red-50" },
];

export default function MobileJoin() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [services, setServices] = useState<any[]>([]);
  const [orgName, setOrgName] = useState("");
  const [step, setStep] = useState<"services" | "details" | "success">("services");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [priority, setPriority] = useState("normal");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string>("");
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      if (!orgId) return;
      const [svc, org, wt] = await Promise.all([
        supabase.from("services").select("*").eq("organization_id", orgId),
        supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
        supabase.from("tokens").select("service_id").eq("organization_id", orgId).eq("status", "waiting"),
      ]);
      setServices(svc.data || []);
      setOrgName(org.data?.name || "Smart Queue");
      const counts: Record<string, number> = {};
      (wt.data || []).forEach((t: any) => { counts[t.service_id] = (counts[t.service_id] || 0) + 1; });
      setWaitingCounts(counts);
    };
    fetch();
  }, [orgId]);

  const joinQueue = async () => {
    if (!selectedService || !orgId) return;
    setLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("generate_token_with_priority", {
        _service_id: selectedService.id,
        _org_id: orgId,
        _priority_level: priority,
      });

      let tokenNumber = rpcData as string;
      if (rpcError || !tokenNumber) {
        const prefix = selectedService.prefix || "T";
        const today = new Date().toISOString().split("T")[0];
        const { count } = await supabase.from("tokens").select("*", { count: "exact", head: true }).eq("service_id", selectedService.id).gte("created_at", today);
        tokenNumber = `${prefix}${String((count || 0) + 1).padStart(3, "0")}`;
        const priorityRank = priority === "urgent" ? 1 : priority === "vip" ? 2 : priority === "elderly" ? 3 : 4;
        const { error: ie } = await supabase.from("tokens").insert({
          organization_id: orgId,
          service_id: selectedService.id,
          token_number: tokenNumber,
          status: "waiting",
          priority_level: priority,
          priority_rank: priorityRank,
        });
        if (ie) throw ie;
      }

      // Update customer info
      const { data: tokenRow } = await supabase.from("tokens").select("id").eq("organization_id", orgId).eq("token_number", tokenNumber).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (tokenRow?.id) {
        await supabase.from("tokens").update({
          customer_name: name || null,
          customer_phone: phone || null,
          visit_reason: reason || null,
        } as any).eq("id", tokenRow.id);
      }

      setGeneratedToken(tokenNumber);
      setStep("success");
      toast.success("You've joined the queue!");
    } catch (err: any) {
      toast.error(err.message || "Failed to join queue");
    } finally {
      setLoading(false);
    }
  };

  // Success state — redirect to tracker
  if (step === "success" && generatedToken) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-scale-in space-y-6 max-w-sm mx-auto">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 border-8 border-emerald-50">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-4xl font-black font-display text-slate-900 tracking-tight">You're In!</h1>
          <div className="rounded-3xl bg-slate-50 border-2 border-slate-200 p-8">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Your Token</p>
            <p className="text-6xl font-black font-display text-violet-600 tracking-tighter">{generatedToken}</p>
            <p className="text-sm font-bold text-slate-500 mt-3">{selectedService?.name}</p>
          </div>



          <Button
            onClick={() => navigate(`/track/${orgId}/${generatedToken}`)}
            className="w-full h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black rounded-2xl shadow-2xl text-lg"
          >
            <Smartphone className="h-5 w-5 mr-2" /> Track My Position
          </Button>

          <p className="text-xs text-slate-400 font-medium">
            Bookmark this page or take a screenshot of your token number.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3">
          {step === "details" && (
            <button onClick={() => setStep("services")} className="h-10 w-10 rounded-xl bg-slate-50 grid place-items-center text-slate-600">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600">
              <span className="text-sm font-bold text-white">Q</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">{orgName}</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Join Queue</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 pb-safe max-w-lg mx-auto w-full">
        {/* Services */}
        {step === "services" && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-2xl font-black font-display text-slate-900 tracking-tight">Select a Service</h2>
            <div className="space-y-3">
              {services.map((s) => {
                const wc = waitingCounts[s.id] || 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedService(s); setStep("details"); }}
                    className="w-full group flex items-center gap-4 rounded-2xl border-2 border-slate-100 bg-white p-4 text-left transition-all hover:border-violet-400 active:scale-[0.98]"
                  >
                    <div className="grid h-14 w-14 place-items-center rounded-xl bg-violet-50 text-violet-600 font-display text-xl font-black group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                      {s.prefix}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 truncate">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-400 font-medium truncate">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-400">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {wc} waiting</span>
                        {wc > 0 && <span className="flex items-center gap-1 text-violet-500"><Clock className="h-3 w-3" /> ~{quickEstimate(wc, s.estimated_duration_minutes || 5)}min</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors shrink-0" />
                  </button>
                );
              })}
              {services.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-base font-bold">No services available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details & Priority */}
        {step === "details" && selectedService && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-2xl font-black font-display text-slate-900 tracking-tight">Your Details</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">For <span className="font-bold text-violet-600">{selectedService.name}</span></p>
            </div>

            <div className="space-y-4">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-12 rounded-xl" />
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (optional)" className="h-12 rounded-xl pl-10" />
              </div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for visit (optional)" className="min-h-[80px] rounded-xl resize-none" />
            </div>



            {/* Priority selection */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Priority</p>
              <div className="grid grid-cols-2 gap-2">
                {priorityOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value)}
                      className={`flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition-all active:scale-[0.97] ${
                        isActive ? opt.active : opt.color + " bg-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={joinQueue}
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-black rounded-2xl shadow-xl text-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2"><span className="h-5 w-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> Joining...</span>
              ) : (
                <>Join Queue <ChevronRight className="h-5 w-5 ml-1" /></>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
