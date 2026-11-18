// Time helpers for Europe/Berlin. Reminder times are stored as UTC instants but are
// always built from Berlin local time, so daylight-saving changes stay correct.

export const TIME_ZONE = "Europe/Berlin";

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** The Berlin wall-clock fields for an instant. */
export function berlinParts(date: Date): LocalParts {
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute };
}

/** Berlin's offset from UTC, in minutes, at a given instant (60 in winter, 120 in summer). */
export function berlinOffsetMinutes(date: Date): number {
  const p = berlinParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - truncated) / 60000);
}

/**
 * Convert a Berlin wall-clock time to a UTC instant.
 * A time skipped by the spring clock change (02:00-03:00) moves forward by an hour;
 * a time repeated by the autumn change resolves to its first occurrence.
 */
export function berlinLocalToUtc(local: LocalParts): Date {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // Berlin is UTC+1 (winter) or UTC+2 (summer): try both and keep those that really show this local time.
  const candidates = [120, 60].map((offset) => naive - offset * 60000);
  const matches = candidates.filter((ms) => {
    const p = berlinParts(new Date(ms));
    return (
      p.year === local.year &&
      p.month === local.month &&
      p.day === local.day &&
      p.hour === local.hour &&
      p.minute === local.minute
    );
  });
  if (matches.length > 0) return new Date(matches[0]); // earliest instant wins for repeated times
  return new Date(candidates[1]); // skipped time: use the winter offset, which lands an hour later
}

/** "HH:MM" to minutes after midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** True when the instant falls inside quiet hours in Berlin (default 22:30-07:00). */
export function isQuietHours(date: Date, start = "22:30", end = "07:00"): boolean {
  const p = berlinParts(date);
  const now = p.hour * 60 + p.minute;
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s > e ? now >= s || now < e : now >= s && now < e;
}

/** The Berlin calendar date one day after the given instant. */
export function berlinTomorrow(date: Date): { year: number; month: number; day: number } {
  const p = berlinParts(date);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}
