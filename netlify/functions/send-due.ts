import type { Config } from "@netlify/functions";
import { adminClient, configuredWebPush, json } from "../lib/server";
import { selectDue, type Reminder } from "../lib/due";
import { sendToSubscriptions } from "../lib/push";

// Runs every 5 minutes on the published (production) deploy and sends reminders that are due.
export default async (): Promise<Response> => {
  const now = new Date();
  const admin = adminClient();

  const { data, error } = await admin
    .from("reminders")
    .select("id, user_id, title, body, send_at, sent_at")
    .is("sent_at", null)
    .lte("send_at", now.toISOString())
    .order("send_at", { ascending: true })
    .limit(100);
  if (error) return json({ error: error.message }, 500);

  const due = selectDue((data ?? []) as Reminder[], now);
  const webpush = configuredWebPush();
  let sent = 0;

  for (const reminder of due) {
    // Claim it first so an overlapping run cannot send it twice.
    const { data: claimed } = await admin
      .from("reminders")
      .update({ sent_at: now.toISOString() })
      .eq("id", reminder.id)
      .is("sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", reminder.user_id);

    const { data: log } = await admin
      .from("push_log")
      .insert({ user_id: reminder.user_id, kind: "reminder", title: reminder.title })
      .select("id")
      .single();

    const result = await sendToSubscriptions(webpush, subs ?? [], {
      title: reminder.title,
      body: reminder.body,
      logId: log?.id,
      tag: `reminder-${reminder.id}`,
      url: "/",
    });
    if (result.expiredIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", result.expiredIds);
    }
    sent += 1;
  }
  return json({ checked: data?.length ?? 0, sent });
};

export const config: Config = { schedule: "*/5 * * * *" };
