import type { RestPeriod } from "../core";

export type PushNotificationState = "unsupported" | "permission_required" | "denied" | "enabled" | "unavailable";

interface PushSubscriptionPayload {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
}

const api = "/api/push";

const supported = (): boolean => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const asPayload = (subscription: PushSubscription | null): PushSubscriptionPayload | null => {
  if (subscription === null) return null;
  const value = subscription.toJSON();
  return typeof value.endpoint === "string" && typeof value.keys?.p256dh === "string" && typeof value.keys.auth === "string"
    ? { endpoint: value.endpoint, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } }
    : null;
};

const subscription = async (): Promise<PushSubscriptionPayload | null> => {
  if (!supported()) return null;
  return asPayload(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
};

const request = async (path: string, method: "POST" | "DELETE", body: unknown): Promise<boolean> => {
  try {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const publicKeyBytes = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const output = new ArrayBuffer(bytes.length);
  new Uint8Array(output).set(Uint8Array.from(bytes, (character) => character.charCodeAt(0)));
  return output;
};

export const getPushNotificationState = async (): Promise<PushNotificationState> => {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return (await subscription()) === null ? "permission_required" : "enabled";
};

export const enablePushNotifications = async (): Promise<PushNotificationState> => {
  if (!supported()) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  try {
    const registration = await navigator.serviceWorker.ready;
    const current = await registration.pushManager.getSubscription();
    const config = await fetch(`${api}/config`);
    const value: unknown = await config.json();
    const publicKey = typeof value === "object" && value !== null ? (value as Record<string, unknown>).publicKey : undefined;
    if (!config.ok || typeof publicKey !== "string") return "unavailable";
    const created = current ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(publicKey) });
    const payload = asPayload(created);
    return payload !== null && await request("/subscriptions", "POST", payload) ? "enabled" : "unavailable";
  } catch {
    return "unavailable";
  }
};

export const scheduleRestNotification = async (rest: RestPeriod): Promise<boolean> => {
  const current = await subscription();
  return current !== null && await request("/rest", "POST", { subscription: current, endsAt: rest.endsAt });
};

export const cancelRestNotification = async (): Promise<boolean> => {
  const current = await subscription();
  return current !== null && await request("/rest", "DELETE", current);
};
