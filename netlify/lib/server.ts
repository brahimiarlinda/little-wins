import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function configuredWebPush(): typeof webpush {
  webpush.setVapidDetails(
    required("VAPID_SUBJECT"),
    required("VAPID_PUBLIC_KEY"),
    required("VAPID_PRIVATE_KEY"),
  );
  return webpush;
}

/** Returns the user id for a valid "Authorization: Bearer <supabase access token>" header. */
export async function userFromRequest(req: Request, admin: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
