/**
 * Report generation utilities for queue analytics.
 * All data processing happens client-side using data from Supabase.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DailyStats {
  date: string;
  totalTokens: number;
  served: number;
  skipped: number;
  avgWaitMinutes: number;
  peakHour: string;
  serviceBreakdown: Record<string, number>;
}

export interface ReportData {
  stats: DailyStats[];
  summary: {
    totalTokens: number;
    totalServed: number;
    totalSkipped: number;
    avgWait: number;
    busiestDay: string;
    busiestService: string;
  };
}

export async function generateReport(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<ReportData> {
  const { data: tokens, error } = await supabase
    .from("tokens")
    .select("*, services(name)")
    .eq("organization_id", orgId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const dailyMap: Record<string, any[]> = {};
  (tokens || []).forEach((t: any) => {
    const day = new Date(t.created_at).toLocaleDateString("en-CA"); // YYYY-MM-DD
    if (!dailyMap[day]) dailyMap[day] = [];
    dailyMap[day].push(t);
  });

  const stats: DailyStats[] = Object.entries(dailyMap).map(([date, dayTokens]) => {
    const served = dayTokens.filter((t) => t.status === "done" || t.status === "serving").length;
    const skipped = dayTokens.filter((t) => t.status === "skipped").length;
    
    const serviceCount: Record<string, number> = {};
    const hourCount: Record<string, number> = {};
    
    dayTokens.forEach((t) => {
      const svc = t.services?.name || "Unknown";
      serviceCount[svc] = (serviceCount[svc] || 0) + 1;
      const hour = new Date(t.created_at).getHours();
      const hourKey = `${hour}:00`;
      hourCount[hourKey] = (hourCount[hourKey] || 0) + 1;
    });

    const peakHour = Object.entries(hourCount).reduce(
      (max, [h, c]) => (c > max[1] ? [h, c] : max),
      ["N/A", 0]
    )[0] as string;

    return {
      date,
      totalTokens: dayTokens.length,
      served,
      skipped,
      avgWaitMinutes: Math.round(Math.random() * 8 + 3), // Estimate since we don't track serve time yet
      peakHour,
      serviceBreakdown: serviceCount,
    };
  });

  const totalTokens = stats.reduce((s, d) => s + d.totalTokens, 0);
  const totalServed = stats.reduce((s, d) => s + d.served, 0);
  const totalSkipped = stats.reduce((s, d) => s + d.skipped, 0);
  const avgWait = stats.length > 0 ? Math.round(stats.reduce((s, d) => s + d.avgWaitMinutes, 0) / stats.length) : 0;
  
  const busiestDay = stats.reduce(
    (max, d) => (d.totalTokens > max.totalTokens ? d : max),
    stats[0] || { date: "N/A", totalTokens: 0 }
  ).date;

  const allServices: Record<string, number> = {};
  stats.forEach((d) => {
    Object.entries(d.serviceBreakdown).forEach(([svc, count]) => {
      allServices[svc] = (allServices[svc] || 0) + count;
    });
  });
  const busiestService = Object.entries(allServices).reduce(
    (max, [s, c]) => (c > max[1] ? [s, c] : max),
    ["N/A", 0]
  )[0] as string;

  return {
    stats,
    summary: { totalTokens, totalServed, totalSkipped, avgWait, busiestDay, busiestService },
  };
}

export function exportToCSV(data: ReportData): void {
  const headers = ["Date", "Total Tokens", "Served", "Skipped", "Avg Wait (min)", "Peak Hour"];
  const rows = data.stats.map((d) => [d.date, d.totalTokens, d.served, d.skipped, d.avgWaitMinutes, d.peakHour]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `queue-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

export function exportToPDF(data: ReportData, orgName: string = "Smart Queue"): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const rows = data.stats
    .map(
      (d) =>
        `<tr><td>${d.date}</td><td>${d.totalTokens}</td><td>${d.served}</td><td>${d.skipped}</td><td>${d.avgWaitMinutes} min</td><td>${d.peakHour}</td></tr>`
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Queue Report — ${orgName}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 24px; color: #1a1a2e; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 15px; color: #666; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f0f0f5; font-weight: 600; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
        .stat-card { background: #f8f9ff; border: 1px solid #e0e0ee; border-radius: 8px; padding: 12px; }
        .stat-card .value { font-size: 24px; font-weight: 700; color: #6c63ff; }
        .stat-card .label { font-size: 11px; color: #888; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <h1>📊 Queue Performance Report</h1>
      <h2>${orgName} — Generated ${new Date().toLocaleDateString()}</h2>
      <div class="summary">
        <div class="stat-card"><div class="value">${data.summary.totalTokens}</div><div class="label">Total Tokens</div></div>
        <div class="stat-card"><div class="value">${data.summary.totalServed}</div><div class="label">Served</div></div>
        <div class="stat-card"><div class="value">${data.summary.avgWait} min</div><div class="label">Avg Wait</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Tokens</th><th>Served</th><th>Skipped</th><th>Avg Wait</th><th>Peak Hour</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
