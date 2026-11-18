import { describe, expect, it } from "vitest";
import { selectDue, type Reminder } from "../netlify/lib/due";

const reminder = (id: string, sendAt: string, sentAt: string | null = null): Reminder => ({
  id,
  user_id: "u1",
  title: "t",
  body: "",
  send_at: sendAt,
  sent_at: sentAt,
});

describe("selectDue", () => {
  const now = new Date("2026-11-09T10:00:00Z"); // 11:00 Berlin

  it("returns reminders that are due and unsent", () => {
    const due = selectDue([reminder("a", "2026-11-09T09:55:00Z"), reminder("b", "2026-11-09T10:00:00Z")], now);
    expect(due.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("skips future reminders", () => {
    expect(selectDue([reminder("a", "2026-11-09T10:01:00Z")], now)).toEqual([]);
  });

  it("skips reminders that were already sent", () => {
    expect(selectDue([reminder("a", "2026-11-09T09:00:00Z", "2026-11-09T09:00:05Z")], now)).toEqual([]);
  });

  it("holds everything back during quiet hours", () => {
    const night = new Date("2026-11-09T22:00:00Z"); // 23:00 Berlin
    expect(selectDue([reminder("a", "2026-11-09T21:00:00Z")], night)).toEqual([]);
  });

  it("sends a reminder that came due at night once quiet hours end", () => {
    const morning = new Date("2026-11-10T06:00:00Z"); // 07:00 Berlin
    expect(selectDue([reminder("a", "2026-11-09T21:00:00Z")], morning).map((r) => r.id)).toEqual(["a"]);
  });
});
