import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  pending: "bg-accent text-accent-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  waiting: "bg-accent text-accent-foreground",
  serving: "bg-action text-action-foreground",
  done: "bg-success text-success-foreground",
  skipped: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusStyles[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}
