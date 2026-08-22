import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import webpush, { type PushSubscription } from "web-push";

interface SubscriptionInput {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
}

interface RestInput {
  readonly subscription: SubscriptionInput;
  readonly endsAt: string;
}

interface ScheduledRest {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly endsAt: string;
}

const port = Number.parseInt(process.env.PUSH_PORT ?? "3000", 10);
const databasePath = process.env.PUSH_DATABASE ?? "/data/push.sqlite";
const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidSubject === undefined || vapidPublicKey === undefined || vapidPrivateKey === undefined) {
  throw new Error("Missing VAPID configuration");
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rest_schedules (
    endpoint TEXT PRIMARY KEY NOT NULL REFERENCES subscriptions(endpoint) ON DELETE CASCADE,
    ends_at TEXT NOT NULL
  );
`);

const send = (response: ServerResponse, status: number, payload?: Readonly<Record<string, unknown>>): void => {
  response.writeHead(status, {
    ...(payload === undefined ? {} : { "content-type": "application/json; charset=utf-8" }),
    "cache-control": "no-store",
  });
  response.end(payload === undefined ? undefined : JSON.stringify(payload));
};

const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new Error("Body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSubscription = (value: unknown): value is SubscriptionInput => {
  if (!isRecord(value) || typeof value.endpoint !== "string" || !value.endpoint.startsWith("https://") || !isRecord(value.keys)) return false;
  return typeof value.keys.p256dh === "string" && value.keys.p256dh.length > 0 && typeof value.keys.auth === "string" && value.keys.auth.length > 0;
};

const isRest = (value: unknown): value is RestInput => {
  if (!isRecord(value) || !isSubscription(value.subscription) || typeof value.endsAt !== "string") return false;
  const endsAt = Date.parse(value.endsAt);
  return Number.isFinite(endsAt) && endsAt >= Date.now() - 10_000 && endsAt <= Date.now() + 86_400_000;
};

const sameOrigin = (request: IncomingMessage): boolean => {
  const origin = request.headers.origin;
  const host = request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] ?? "http";
  return typeof origin === "string" && typeof host === "string" && origin === `${protocol}://${host}`;
};

const saveSubscription = (subscription: SubscriptionInput): void => {
  database.prepare(`
    INSERT INTO subscriptions (endpoint, p256dh, auth, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at
  `).run(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, new Date().toISOString());
};

const scheduleRest = (input: RestInput): void => {
  saveSubscription(input.subscription);
  database.prepare(`
    INSERT INTO rest_schedules (endpoint, ends_at)
    VALUES (?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET ends_at = excluded.ends_at
  `).run(input.subscription.endpoint, new Date(input.endsAt).toISOString());
};

const cancelRest = (subscription: SubscriptionInput): void => {
  database.prepare("DELETE FROM rest_schedules WHERE endpoint = ?").run(subscription.endpoint);
};

const dueRests = (): readonly ScheduledRest[] => database.prepare(`
  SELECT subscriptions.endpoint, subscriptions.p256dh, subscriptions.auth, rest_schedules.ends_at AS endsAt
  FROM rest_schedules
  INNER JOIN subscriptions ON subscriptions.endpoint = rest_schedules.endpoint
  WHERE rest_schedules.ends_at <= ?
`).all(new Date().toISOString()) as unknown as readonly ScheduledRest[];

const clearSchedule = (endpoint: string): void => {
  database.prepare("DELETE FROM rest_schedules WHERE endpoint = ?").run(endpoint);
};

const removeSubscription = (endpoint: string): void => {
  database.prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(endpoint);
};

const notificationPayload = JSON.stringify({ title: "Descanso terminado", body: "Vuelve a tu próxima serie." });

const sendDueNotifications = async (): Promise<void> => {
  for (const rest of dueRests()) {
    try {
      await webpush.sendNotification({ endpoint: rest.endpoint, keys: { p256dh: rest.p256dh, auth: rest.auth } } as PushSubscription, notificationPayload, { TTL: 60, urgency: "high" });
      clearSchedule(rest.endpoint);
    } catch (error) {
      const statusCode = isRecord(error) && typeof error.statusCode === "number" ? error.statusCode : undefined;
      if (statusCode === 404 || statusCode === 410) removeSubscription(rest.endpoint);
      else clearSchedule(rest.endpoint);
      console.error("Unable to send rest notification", statusCode ?? "unknown");
    }
  }
};

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET" && path === "/health") {
    send(response, 200, { ok: true });
    return;
  }
  if (request.method === "GET" && path === "/config") {
    send(response, 200, { publicKey: vapidPublicKey });
    return;
  }
  if (!sameOrigin(request)) {
    send(response, 403, { error: "forbidden" });
    return;
  }
  try {
    if (request.method === "POST" && path === "/subscriptions") {
      const subscription = await readBody(request);
      if (!isSubscription(subscription)) {
        send(response, 400, { error: "invalid_subscription" });
        return;
      }
      saveSubscription(subscription);
      send(response, 204);
      return;
    }
    if (request.method === "POST" && path === "/rest") {
      const rest = await readBody(request);
      if (!isRest(rest)) {
        send(response, 400, { error: "invalid_rest" });
        return;
      }
      scheduleRest(rest);
      send(response, 204);
      return;
    }
    if (request.method === "DELETE" && path === "/rest") {
      const subscription = await readBody(request);
      if (!isSubscription(subscription)) {
        send(response, 400, { error: "invalid_subscription" });
        return;
      }
      cancelRest(subscription);
      send(response, 204);
      return;
    }
    send(response, 404, { error: "not_found" });
  } catch {
    send(response, 400, { error: "invalid_request" });
  }
});

server.listen(port, "0.0.0.0");
setInterval(() => { void sendDueNotifications(); }, 1_000);
void sendDueNotifications();
