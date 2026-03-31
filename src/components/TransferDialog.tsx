import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: any;
  services: any[];
  organizationId: string;
  onTransferred: () => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  token,
  services,
  organizationId,
  onTransferred,
}: TransferDialogProps) {
  const [targetServiceId, setTargetServiceId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!targetServiceId || !token) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tokens")
        .update({
          service_id: targetServiceId,
          status: "waiting",
          counter_id: null,
        })
        .eq("id", token.id);

      if (error) throw error;
      toast.success(`Token ${token.token_number} transferred successfully`);
      onTransferred();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[hsl(230,22%,10%)] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Transfer Token</DialogTitle>
          <DialogDescription className="text-slate-400">
            Move <span className="font-bold text-white">{token?.token_number}</span> to a different service queue.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Select Target Service
          </label>
          <select
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            value={targetServiceId}
            onChange={(e) => setTargetServiceId(e.target.value)}
          >
            <option value="">Choose a service...</option>
            {services
              .filter((s) => s.id !== token?.service_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!targetServiceId || loading}
            className="bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:opacity-90"
          >
            {loading ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
