import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type PaymentState = "verifying" | "success" | "failed";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<PaymentState>("verifying");
  const [message, setMessage] = useState("We are confirming your payment...");

  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("tx_ref");

    if (!reference) {
      setState("failed");
      setMessage("No payment reference was provided by Paystack.");
      return;
    }

    const verify = async () => {
      const { data, error } = await supabase.functions.invoke("payment-verify", {
        body: { reference },
      });

      if (error || !data?.success) {
        setState("failed");
        setMessage(
          error?.message ||
            "Payment verification failed on Paystack. If you were charged, contact support with your transaction reference.",
        );
        return;
      }

      setState("success");
      setMessage("Payment confirmed. Your company request is now pending super-admin approval.");
    };

    void verify();
  }, [searchParams]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-white">
        <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-br from-blue-100/80 via-violet-50/50 to-transparent blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/40">
        {state === "verifying" && (
          <div className="mx-auto mb-8 h-16 w-16 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin" />
        )}

        {state === "success" && (
          <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-full bg-emerald-50 border-8 border-emerald-100/60">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
        )}

        {state === "failed" && (
          <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-full bg-red-50 border-8 border-red-100/60">
            <XCircle className="h-10 w-10 text-red-600" />
          </div>
        )}

        <h1 className="text-3xl font-black font-display text-slate-900 drop-shadow-sm">
          {state === "verifying" && "Verifying payment"}
          {state === "success" && "Payment successful"}
          {state === "failed" && "Payment not completed"}
        </h1>

        <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">{message}</p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12 flex-1 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-xl">
            <Link to="/company-login">
              Go to Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 flex-1 border-slate-200 bg-white text-slate-700 font-bold rounded-xl">
            <Link to="/company-signup">Try Again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
