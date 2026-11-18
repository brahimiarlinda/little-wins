import type { Config } from "@netlify/functions";
import { json } from "../lib/server";

// Public by design: the browser needs this key to subscribe to push.
export default async (): Promise<Response> => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return json({ error: "VAPID_PUBLIC_KEY is not set" }, 500);
  return json({ key });
};

export const config: Config = { path: "/api/vapid-key" };
