import { isQuietHours } from "../../shared/time";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  body: string;
  send_at: string;
  sent_at: string | null;
}

/**
 * Reminders that should be sent now: not yet sent, due, and not during quiet hours.
 * A reminder that comes due in quiet hours stays pending and goes out at 07:00.
 */
export function selectDue(reminders: Reminder[], now: Date): Reminder[] {
  if (isQuietHours(now)) return [];
  return reminders.filter((r) => r.sent_at === null && new Date(r.send_at).getTime() <= now.getTime());
}
