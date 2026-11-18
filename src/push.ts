import type { SupabaseClient } from "@supabase/supabase-js";

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function permissionState(): NotificationPermission | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

async function fetchVapidKey(): Promise<string> {
  const res = await fetch("/api/vapid-key");
  if (!res.ok) throw new Error("The server has no push key yet (check VAPID_PUBLIC_KEY in Netlify).");
  const { key } = (await res.json()) as { key: string };
  return key;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Asks for permission (must be called from a tap), subscribes this device to push
 * and saves the subscription in the database.
 */
export async function enableNotifications(supabase: SupabaseClient, userId: string): Promise<void> {
  if (!pushSupported()) throw new Error("This browser cannot receive push notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications were not allowed. Turn them on for Little Wins in the iPhone Settings.");
  }
  const registration = await navigator.serviceWorker.ready;
  const key = await fetchVapidKey();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("The subscription is incomplete.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}
