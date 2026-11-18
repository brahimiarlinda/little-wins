import { describe, expect, it, vi } from "vitest";
import { sendToSubscriptions, type PushSender, type StoredSubscription } from "../netlify/lib/push";

const subs: StoredSubscription[] = [
  { id: "1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
  { id: "2", endpoint: "https://push.example/2", p256dh: "k2", auth: "a2" },
  { id: "3", endpoint: "https://push.example/3", p256dh: "k3", auth: "a3" },
];

describe("sendToSubscriptions", () => {
  it("sends the payload as JSON to every subscription", async () => {
    const send = vi.fn().mockResolvedValue({});
    const sender: PushSender = { sendNotification: send };
    const result = await sendToSubscriptions(sender, subs, { title: "Hi", body: "There", logId: "L1" });
    expect(result).toEqual({ delivered: 3, failed: 0, expiredIds: [] });
    expect(send).toHaveBeenCalledTimes(3);
    const [subscription, body] = send.mock.calls[0];
    expect(subscription).toEqual({ endpoint: "https://push.example/1", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(body)).toEqual({ title: "Hi", body: "There", logId: "L1" });
  });

  it("reports expired subscriptions (404 and 410) and keeps going after a failure", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error("server"), { statusCode: 500 }))
      .mockResolvedValueOnce({});
    const result = await sendToSubscriptions({ sendNotification: send }, subs, { title: "t", body: "b" });
    expect(result).toEqual({ delivered: 1, failed: 2, expiredIds: ["1"] });
  });

  it("handles no subscriptions", async () => {
    const send = vi.fn();
    const result = await sendToSubscriptions({ sendNotification: send }, [], { title: "t", body: "b" });
    expect(result).toEqual({ delivered: 0, failed: 0, expiredIds: [] });
    expect(send).not.toHaveBeenCalled();
  });
});
