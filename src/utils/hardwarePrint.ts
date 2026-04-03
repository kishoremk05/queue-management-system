export interface HardwarePrintPayload {
  organizationName: string;
  tokenNumber: string;
  serviceName: string;
  priorityLevel: string;
  createdAtIso: string;
  customerName?: string | null;
  visitReason?: string | null;
  trackingUrl?: string | null;
}

interface BridgeResponse {
  ok?: boolean;
  jobId?: string;
  printerName?: string;
  message?: string;
}

export interface HardwarePrintResult {
  success: boolean;
  endpoint?: string;
  jobId?: string;
  printerName?: string;
  error?: string;
}

const DEFAULT_ENDPOINTS = [
  "http://127.0.0.1:3210/print-token",
  "http://localhost:3210/print-token",
];

function normalizeEndpoint(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/print-token")) return trimmed;
  return `${trimmed}/print-token`;
}

function resolveEndpoints(): string[] {
  const envEndpoint = (import.meta.env.VITE_PRINTER_BRIDGE_URL as string | undefined) || "";
  const lsEndpoint = window.localStorage.getItem("kioskPrinterBridgeUrl") || "";

  const preferred = [normalizeEndpoint(lsEndpoint), normalizeEndpoint(envEndpoint)].filter(Boolean);
  const unique = new Set<string>([...preferred, ...DEFAULT_ENDPOINTS]);

  return Array.from(unique);
}

async function postWithTimeout(endpoint: string, payload: HardwarePrintPayload, timeoutMs = 2500): Promise<BridgeResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as BridgeResponse;
    }

    return { ok: true };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function printTokenWithBridge(payload: HardwarePrintPayload): Promise<HardwarePrintResult> {
  const endpoints = resolveEndpoints();
  let lastError = "Printer bridge not reachable";

  for (const endpoint of endpoints) {
    try {
      const response = await postWithTimeout(endpoint, payload);
      if (response.ok !== false) {
        return {
          success: true,
          endpoint,
          jobId: response.jobId,
          printerName: response.printerName,
        };
      }

      lastError = response.message || `Bridge rejected print at ${endpoint}`;
    } catch (error: any) {
      lastError = error?.name === "AbortError"
        ? `Timed out contacting ${endpoint}`
        : (error?.message || `Failed to connect to ${endpoint}`);
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
