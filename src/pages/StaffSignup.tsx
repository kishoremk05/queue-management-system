import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Lock, Mail, User, Check } from "lucide-react";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function StaffSignup() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    organization_id: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const organizationId = form.organization_id.trim();
    if (!UUID_PATTERN.test(organizationId)) {
      toast.error("Paste the company UUID, not an email address.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError) throw authError;

      const { error: reqError } = await supabase
        .from("staff_requests")
        .insert({
          user_id: authData.user?.id,
          organization_id: organizationId,
          name: form.name,
          email: form.email,
          status: "pending",
        });
      if (reqError) throw reqError;

      await supabase.auth.signOut();
      setSubmitted(true);
      toast.success("Staff request submitted! Wait for admin approval.");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900 font-sans">
        <div className="pointer-events-none absolute inset-0 bg-white">
          <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-br from-emerald-100/80 via-blue-50/50 to-transparent blur-3xl" />
        </div>
        <div className="relative w-full max-w-md text-center animate-scale-in">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/50">
            <div className="mx-auto mb-8 grid h-24 w-24 place-items-center rounded-full bg-emerald-50 border-8 border-emerald-100/50">
              <Check className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black font-display mb-4 tracking-tight drop-shadow-sm">Request Submitted</h2>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed">
              Your staff registration is pending approval from your company admin. You'll be able to login once approved.
            </p>
            <Button
              asChild
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all hover:-translate-y-0.5"
            >
              <Link to="/">
                Back to Home
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-white">
        <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-br from-blue-100/80 via-cyan-50/50 to-transparent blur-3xl" />
        <div className="absolute -left-20 top-60 h-72 w-72 rounded-full bg-violet-100/50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to home
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/50">
          <div className="mb-10 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-md shadow-blue-500/20 mb-6">
              <User className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-black font-display text-slate-900 drop-shadow-sm">Staff Registration</h1>
            <p className="mt-3 text-lg font-medium text-slate-500">
              Join your company's workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2.5">
              <Label className="text-sm font-bold text-slate-700">Full Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  required
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-14 pl-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 font-medium shadow-sm transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-slate-700">Company UUID</Label>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Required</span>
              </div>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  required
                  placeholder="Paste organization UUID from admin"
                  value={form.organization_id}
                  onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
                  className="h-14 pl-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 font-mono text-sm shadow-sm transition-all tracking-wider"
                />
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Use the company UUID copied from the admin dashboard. It is not the company email address.
              </p>
            </div>

            <div className="space-y-2.5">
              <Label className="text-sm font-bold text-slate-700">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="email"
                  required
                  placeholder="staff@company.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-14 pl-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 font-medium shadow-sm transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="text-sm font-bold text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="h-14 pl-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 font-medium shadow-sm transition-all text-base"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting Request...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Submit Request
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-200 text-center">
            <p className="text-sm font-medium text-slate-500">
              Already have access?{" "}
              <Link to="/company-login" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">
                Login to Workspace
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
