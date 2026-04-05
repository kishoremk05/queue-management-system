/**
 * Wait-time prediction utility.
 *
 * Strategy:
 * 1. Fetch the last N completed tokens for the same service.
 * 2. Compute average actual service time from (served_at – created_at) or
 *    (completed_at – created_at).
 * 3. Multiply by queue position.
 * 4. Fall back to service.estimated_duration_minutes * position.
 */

import { supabase } from "@/integrations/supabase/client";

const HISTORY_SIZE = 20;
const DEFAULT_SERVICE_MINUTES = 5;

interface PredictionResult {
  estimatedMinutes: number;
  confidence: "high" | "medium" | "low";
  basedOn: "historical" | "configured" | "default";
  sampleSize: number;
}

/**
 * Predict estimated wait time in minutes for a token at the given position.
 */
export async function predictWaitTime(
  orgId: string,
  serviceId: string,
  positionInQueue: number
): Promise<PredictionResult> {
  if (positionInQueue <= 0) {
    return { estimatedMinutes: 0, confidence: "high", basedOn: "default", sampleSize: 0 };
  }

  // 1. Try to get historical average from completed tokens
  try {
    const { data: completedTokens } = await supabase
      .from("tokens")
      .select("created_at, served_at, completed_at, actual_wait_minutes")
      .eq("organization_id", orgId)
      .eq("service_id", serviceId)
      .in("status", ["done", "serving"])
      .not("created_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(HISTORY_SIZE);

    if (completedTokens && completedTokens.length >= 3) {
      const durations: number[] = [];

      for (const t of completedTokens) {
        // Prefer actual_wait_minutes if stored
        if (t.actual_wait_minutes && t.actual_wait_minutes > 0) {
          durations.push(t.actual_wait_minutes);
          continue;
        }
        // Calculate from timestamps
        const endTime = t.served_at || t.completed_at;
        if (endTime && t.created_at) {
          const start = new Date(t.created_at).getTime();
          const end = new Date(endTime).getTime();
          const diffMin = (end - start) / 60000;
          if (diffMin > 0 && diffMin < 480) {
            // Ignore outliers > 8 hours
            durations.push(diffMin);
          }
        }
      }

      if (durations.length >= 3) {
        // Remove top/bottom outlier and average
        durations.sort((a, b) => a - b);
        const trimmed = durations.slice(1, -1);
        const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
        const estimated = Math.round(avg * positionInQueue);

        return {
          estimatedMinutes: Math.max(1, estimated),
          confidence: durations.length >= 10 ? "high" : "medium",
          basedOn: "historical",
          sampleSize: durations.length,
        };
      }
    }
  } catch (err) {
    console.warn("Historical wait time lookup failed:", err);
  }

  // 2. Fall back to configured estimated_duration_minutes
  try {
    const { data: service } = await supabase
      .from("services")
      .select("estimated_duration_minutes")
      .eq("id", serviceId)
      .maybeSingle();

    if (service?.estimated_duration_minutes) {
      return {
        estimatedMinutes: Math.max(1, service.estimated_duration_minutes * positionInQueue),
        confidence: "medium",
        basedOn: "configured",
        sampleSize: 0,
      };
    }
  } catch (err) {
    console.warn("Service duration lookup failed:", err);
  }

  // 3. Default fallback
  return {
    estimatedMinutes: Math.max(1, DEFAULT_SERVICE_MINUTES * positionInQueue),
    confidence: "low",
    basedOn: "default",
    sampleSize: 0,
  };
}

/**
 * Quick synchronous estimation (no network) for display purposes.
 */
export function quickEstimate(
  positionInQueue: number,
  avgServiceMinutes: number = DEFAULT_SERVICE_MINUTES
): number {
  return Math.max(1, Math.round(avgServiceMinutes * positionInQueue));
}
