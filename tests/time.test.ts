import { describe, expect, it } from "vitest";
import {
  berlinLocalToUtc,
  berlinOffsetMinutes,
  berlinParts,
  berlinTomorrow,
  isQuietHours,
} from "../shared/time";

const local = (year: number, month: number, day: number, hour: number, minute: number) => ({
  year,
  month,
  day,
  hour,
  minute,
});

describe("Berlin time conversion", () => {
  it("07:30 in winter is 06:30 UTC", () => {
    expect(berlinLocalToUtc(local(2026, 11, 9, 7, 30)).toISOString()).toBe("2026-11-09T06:30:00.000Z");
  });

  it("07:30 in summer is 05:30 UTC", () => {
    expect(berlinLocalToUtc(local(2026, 7, 1, 7, 30)).toISOString()).toBe("2026-07-01T05:30:00.000Z");
  });

  it("keeps 07:30 local on both sides of the March 2026 clock change", () => {
    const before = berlinLocalToUtc(local(2026, 3, 28, 7, 30));
    const after = berlinLocalToUtc(local(2026, 3, 30, 7, 30));
    expect(berlinParts(before)).toMatchObject({ day: 28, hour: 7, minute: 30 });
    expect(berlinParts(after)).toMatchObject({ day: 30, hour: 7, minute: 30 });
    expect(before.toISOString()).toBe("2026-03-28T06:30:00.000Z");
    expect(after.toISOString()).toBe("2026-03-30T05:30:00.000Z");
  });

  it("keeps 07:30 local on both sides of the October 2026 clock change", () => {
    expect(berlinLocalToUtc(local(2026, 10, 24, 7, 30)).toISOString()).toBe("2026-10-24T05:30:00.000Z");
    expect(berlinLocalToUtc(local(2026, 10, 26, 7, 30)).toISOString()).toBe("2026-10-26T06:30:00.000Z");
  });

  it("moves a skipped spring time (02:30 on 29 March 2026) forward to 03:30 local", () => {
    const result = berlinLocalToUtc(local(2026, 3, 29, 2, 30));
    expect(berlinParts(result)).toMatchObject({ day: 29, hour: 3, minute: 30 });
  });

  it("uses the first occurrence of a repeated autumn time (02:30 on 25 October 2026)", () => {
    expect(berlinLocalToUtc(local(2026, 10, 25, 2, 30)).toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("reports the offset", () => {
    expect(berlinOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(60);
    expect(berlinOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(120);
  });

  it("finds tomorrow's Berlin date across a month end", () => {
    expect(berlinTomorrow(new Date("2026-11-30T12:00:00Z"))).toEqual({ year: 2026, month: 12, day: 1 });
  });

  it("uses the Berlin date late in the evening UTC", () => {
    // 23:30 UTC on 30 Nov is already 00:30 on 1 Dec in Berlin, so tomorrow is 2 Dec.
    expect(berlinTomorrow(new Date("2026-11-30T23:30:00Z"))).toEqual({ year: 2026, month: 12, day: 2 });
  });
});

describe("quiet hours (22:30 to 07:00 Berlin)", () => {
  const at = (iso: string) => new Date(iso);

  it("is quiet at night and the early morning", () => {
    expect(isQuietHours(at("2026-11-09T21:30:00Z"))).toBe(true); // 22:30 Berlin
    expect(isQuietHours(at("2026-11-09T03:00:00Z"))).toBe(true); // 04:00 Berlin
    expect(isQuietHours(at("2026-11-09T05:59:00Z"))).toBe(true); // 06:59 Berlin
  });

  it("is not quiet from 07:00 until 22:29", () => {
    expect(isQuietHours(at("2026-11-09T06:00:00Z"))).toBe(false); // 07:00 Berlin
    expect(isQuietHours(at("2026-11-09T12:00:00Z"))).toBe(false);
    expect(isQuietHours(at("2026-11-09T21:29:00Z"))).toBe(false); // 22:29 Berlin
  });

  it("follows Berlin time in summer (UTC+2)", () => {
    expect(isQuietHours(at("2026-07-09T20:30:00Z"))).toBe(true); // 22:30 Berlin
    expect(isQuietHours(at("2026-07-09T20:29:00Z"))).toBe(false); // 22:29 Berlin
    expect(isQuietHours(at("2026-07-10T05:00:00Z"))).toBe(false); // 07:00 Berlin
  });
});
