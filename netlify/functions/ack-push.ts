import type { Config } from "@netlify/functions";
import { adminClient, json } from "../lib/server";

// The service worker calls this after showing a notification, so the app can display
// "last push received". It carries only the random log id; it cannot read or change anything else.
export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let logId = "";
  try {
    const body = (await req.json()) as { logId?: unknown };
    logId = typeof body.logId === "string" ? body.logId : "";
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(logId)) return json({ error: "Bad id" }, 400);

  const admin = adminClient();
  await admin
    .from("push_log")
    .update({ received_at: new Date().toISOString() })
    .eq("id", logId)
    .is("received_at", null);
  return json({ ok: true });
};

export const config: Config = { path: "/api/ack-push" };
