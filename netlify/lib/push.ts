import type { PushSubscription } from "web-push";

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  logId?: string;
  tag?: string;
  url?: string;
}

/** The part of the web-push library we use; replaced by a fake in tests. */
export interface PushSender {
  sendNotification(subscription: PushSubscription, payload: string): Promise<unknown>;
}

export interface SendResult {
  delivered: number;
  failed: number;
  /** Subscriptions the push service says are gone (404/410); delete them from the database. */
  expiredIds: string[];
}

export async function sendToSubscriptions(
  sender: PushSender,
  subscriptions: StoredSubscription[],
  payload: PushPayload,
): Promise<SendResult> {
  const result: SendResult = { delivered: 0, failed: 0, expiredIds: [] };
  const body = JSON.stringify(payload);
  for (const sub of subscriptions) {
    try {
      await sender.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      result.delivered += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      result.failed += 1;
      if (status === 404 || status === 410) result.expiredIds.push(sub.id);
    }
  }
  return result;
}
