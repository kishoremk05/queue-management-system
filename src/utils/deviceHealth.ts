/**
 * Device health monitoring for kiosks, displays, and printers.
 * Sends periodic heartbeats to Supabase and checks device statuses.
 */

import { supabase } from "@/integrations/supabase/client";

export type DeviceType = "kiosk" | "display" | "printer";

export interface DeviceStatus {
  id: string;
  device_type: DeviceType;
  device_name: string | null;
  status: "online" | "offline" | "warning";
  last_heartbeat: string;
  metadata: Record<string, any>;
}

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const OFFLINE_THRESHOLD_MS = 90_000; // 90 seconds without heartbeat = offline

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentDeviceId: string | null = null;

/**
 * Start sending periodic heartbeats for this device.
 */
export function startHeartbeat(
  orgId: string,
  deviceType: DeviceType,
  deviceName?: string,
  metadata?: Record<string, any>
): void {
  stopHeartbeat();

  const send = async () => {
    try {
      if (currentDeviceId) {
        await supabase
          .from("device_health")
          .update({
            status: "online",
            last_heartbeat: new Date().toISOString(),
            metadata: metadata || {},
          } as any)
          .eq("id", currentDeviceId);
      } else {
        // Upsert — find existing or create
        const { data: existing } = await supabase
          .from("device_health")
          .select("id")
          .eq("organization_id", orgId)
          .eq("device_type", deviceType)
          .eq("device_name", deviceName || "")
          .maybeSingle();

        if (existing) {
          currentDeviceId = existing.id;
          await supabase
            .from("device_health")
            .update({
              status: "online",
              last_heartbeat: new Date().toISOString(),
              metadata: metadata || {},
            } as any)
            .eq("id", currentDeviceId);
        } else {
          const { data: created } = await supabase
            .from("device_health")
            .insert({
              organization_id: orgId,
              device_type: deviceType,
              device_name: deviceName || `${deviceType}-${Date.now()}`,
              status: "online",
              last_heartbeat: new Date().toISOString(),
              metadata: metadata || {},
            } as any)
            .select("id")
            .single();
          if (created) currentDeviceId = created.id;
        }
      }
    } catch (err) {
      console.warn("Heartbeat failed:", err);
    }
  };

  // Send immediately, then periodically
  send();
  heartbeatTimer = setInterval(send, HEARTBEAT_INTERVAL);
}

/**
 * Stop sending heartbeats.
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  currentDeviceId = null;
}

/**
 * Fetch all device statuses for an organization.
 */
export async function getDeviceStatuses(orgId: string): Promise<DeviceStatus[]> {
  const { data, error } = await supabase
    .from("device_health")
    .select("*")
    .eq("organization_id", orgId)
    .order("device_type")
    .order("device_name");

  if (error) {
    console.error("Failed to fetch device statuses:", error);
    return [];
  }

  const now = Date.now();
  return (data || []).map((d: any) => ({
    ...d,
    // Override status based on heartbeat recency
    status: isDeviceOnline(d.last_heartbeat, now) ? d.status : "offline",
  }));
}

/**
 * Check if the printer bridge is reachable.
 */
export async function checkPrinterBridgeHealth(): Promise<{
  online: boolean;
  printerName?: string;
  error?: string;
}> {
  const urls = [
    window.localStorage.getItem("kioskPrinterBridgeUrl")?.replace(/\/print-token$/, "/health") || "",
    "http://127.0.0.1:3210/health",
    "http://localhost:3210/health",
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return {
          online: true,
          printerName: json.printerName || json.printer || "Unknown",
        };
      }
    } catch {
      // Try next URL
    }
  }

  return { online: false, error: "Printer bridge not reachable" };
}

function isDeviceOnline(lastHeartbeat: string | null, nowMs: number): boolean {
  if (!lastHeartbeat) return false;
  const hbMs = new Date(lastHeartbeat).getTime();
  return nowMs - hbMs < OFFLINE_THRESHOLD_MS;
}
