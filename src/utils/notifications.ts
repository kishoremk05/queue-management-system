/**
 * Notifications utility — browser push notifications
 * and Supabase edge function callers for SMS / WhatsApp.
 */

import { supabase } from "@/integrations/supabase/client";

/* ──────────────────── Browser Push Notifications ──────────────────── */

export function isBrowserNotificationsSupported(): boolean {
  return "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendBrowserNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; requireInteraction?: boolean }
): void {
  if (!isBrowserNotificationsSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      body,
      icon: options?.icon || "/favicon.ico",
      tag: options?.tag || "queue-notification",
      requireInteraction: options?.requireInteraction ?? false,
      badge: "/favicon.ico",
    });
  } catch (e) {
    console.warn("Browser notification failed:", e);
  }
}

/* ──────────────────── Vibration Feedback ──────────────────── */

export function vibrateDevice(pattern: number | number[] = [200, 100, 200]): void {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

/* ──────────────────── SMS via Supabase Edge Function ──────────────────── */

export async function sendSmsNotification(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { phone, message },
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("SMS notification failed:", err);
    return { success: false, error: err.message || "SMS send failed" };
  }
}

/* ──────────────────── WhatsApp via Edge Function ──────────────────── */

export async function sendWhatsAppNotification(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: { phone, message },
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("WhatsApp notification failed:", err);
    return { success: false, error: err.message || "WhatsApp send failed" };
  }
}

/* ──────────────────── Queue Turn Notification ──────────────────── */

export function buildTurnNotificationMessage(
  tokenNumber: string,
  orgName: string,
  turnsAway?: number
): string {
  if (turnsAway !== undefined && turnsAway > 0) {
    return `${orgName}: Your token ${tokenNumber} is ${turnsAway} turn${turnsAway > 1 ? "s" : ""} away. Please prepare to visit the counter.`;
  }
  return `${orgName}: It's your turn! Token ${tokenNumber} — please proceed to the counter now.`;
}

export function buildTokenIssuedMessage(
  tokenNumber: string,
  orgName: string,
  serviceName: string,
  trackingUrl: string
): string {
  return `${orgName}: Your queue token is ${tokenNumber} for ${serviceName}. Track your position: ${trackingUrl}`;
}
