import type { Config } from "@netlify/functions";
import { adminClient, configuredWebPush, json, userFromRequest } from "../lib/server";
import { sendToSubscriptions } from "../lib/push";

// Sends a test notification to every device you have turned notifications on for.
export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const admin = adminClient();
  const userId = await userFromRequest(req, admin);
  if (!userId) return json({ error: "Not signed in" }, 401);

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) return json({ error: error.message }, 500);
  if (!subs || subs.length === 0) {
    return json({ error: "No device has notifications turned on yet." }, 400);
  }

  const title = "Test notification";
  const { data: log, error: logError } = await admin
    .from("push_log")
    .insert({ user_id: userId, kind: "test", title })
    .select("id")
    .single();
  if (logError || !log) return json({ error: logError?.message ?? "Could not write log" }, 500);

  const result = await sendToSubscriptions(configuredWebPush(), subs, {
    title,
    body: "If you can read this on your Lock Screen, push works.",
    logId: log.id,
    tag: "test",
    url: "/",
  });
  if (result.expiredIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", result.expiredIds);
  }
  return json(result);
};

export const config: Config = { path: "/api/send-test" };
