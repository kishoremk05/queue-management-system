import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function CompanyLogin() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        toast.error("Your account is pending approval.", {
          description: "An admin will review and activate your account shortly.",
          duration: 6000,
        });
        return;
      }


      if (roleData.role === "company_admin") {
        navigate("/company-dashboard");
      } else if (roleData.role === "staff") {
        navigate("/staff");
      } else if (roleData.role === "super_admin") {
        navigate("/super-admin");
      } else {
        toast.error("Unknown role");
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Left panel - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-white border-r border-slate-200">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-violet-100/50 blur-3xl" />
          <div className="absolute right-10 bottom-1/4 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md p-12 animate-fade-up">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-md shadow-violet-500/20 mb-8">
            <span className="text-2xl font-black text-white">Q</span>
          </div>
          <h2 className="text-4xl font-black font-display mb-6 tracking-tight text-slate-900">
            Welcome back to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600">Smart Queue</span>
          </h2>
          <p className="text-lg font-medium text-slate-500 leading-relaxed max-w-sm">
            Manage your queues, monitor performance, and deliver exceptional
            customer experiences.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            {[
              { value: "24/7", label: "Cloud Access" },
              { value: "99.9%", label: "Uptime SLA" },
              { value: "< 50ms", label: "Latency" },
              { value: "256-bit", label: "Encryption" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <p className="text-2xl font-black text-slate-900 font-display">{stat.value}</p>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md animate-fade-up" style={{ animationDelay: "100ms" }}>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-violet-600 transition-colors mb-10 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to home
          </Link>

          <div className="mb-10">
            <h1 className="text-4xl font-black font-display text-slate-900 drop-shadow-sm">Sign In</h1>
            <p className="mt-3 text-lg font-medium text-slate-500">
              Enter your credentials to access your workspace
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-bold text-slate-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 pl-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-violet-500 font-medium shadow-sm transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-bold text-slate-700">
                  Password
                </Label>
                <a href="#" className="text-sm font-bold text-violet-600 hover:text-violet-700 transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 pl-12 pr-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-violet-500 font-medium shadow-sm transition-all text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-10 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-50 px-4 text-slate-400 font-bold uppercase tracking-widest">or continue with</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Link 
                 to="/company-signup" 
                 className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition-all text-center group"
               >
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-violet-600">Company</span>
                 <span className="text-sm font-bold text-slate-900 group-hover:text-violet-700">Register New</span>
               </Link>
               
               <Link 
                 to="/staff-signup" 
                 className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all text-center group"
               >
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-600">Staff</span>
                 <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">Join Workspace</span>
               </Link>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
