import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  currentSubscription,
  enableNotifications,
  isIos,
  isStandalone,
  permissionState,
  pushSupported,
} from "./push";
import { berlinLocalToUtc, berlinTomorrow } from "../shared/time";

interface LogRow {
  id: string;
  kind: string;
  title: string;
  sent_at: string;
  received_at: string | null;
}

interface ReminderRow {
  id: string;
  title: string;
  send_at: string;
  sent_at: string | null;
}

const berlinFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const fmt = (iso: string) => berlinFormat.format(new Date(iso));

function Step({ ok, title, hint }: { ok: boolean; title: string; hint?: string }) {
  return (
    <li className={ok ? "step done" : "step"}>
      <span className="mark" aria-hidden>{ok ? "✓" : "○"}</span>
      <span>
        <strong>{title}</strong>
        {!ok && hint && <span className="hint">{hint}</span>}
      </span>
    </li>
  );
}

export default function Home({ session }: { session: Session }) {
  const userId = session.user.id;
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState(permissionState());
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);

  const installed = isStandalone();
  const supported = pushSupported();

  const refresh = useCallback(async () => {
    setPermission(permissionState());
    setSubscribed((await currentSubscription()) !== null);
    const [logResult, reminderResult] = await Promise.all([
      supabase.from("push_log").select("id, kind, title, sent_at, received_at").order("sent_at", { ascending: false }).limit(6),
      supabase.from("reminders").select("id, title, send_at, sent_at").order("send_at", { ascending: false }).limit(5),
    ]);
    if (logResult.data) setLog(logResult.data as LogRow[]);
    if (reminderResult.data) setReminders(reminderResult.data as ReminderRow[]);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const result = await action();
      if (result) setMessage(result);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const turnOn = () => run(async () => {
    await enableNotifications(supabase, userId);
    return "Notifications are on for this device.";
  });

  const sendNow = () => run(async () => {
    const res = await fetch("/api/send-test", {
      method: "POST",
      headers: { authorization: `Bearer ${session.access_token}` },
    });
    const body = (await res.json()) as { error?: string; delivered?: number; failed?: number };
    if (!res.ok) throw new Error(body.error ?? "The server could not send the test.");
    return `Sent to ${body.delivered} device(s). It should appear within a few seconds.`;
  });

  async function schedule(sendAt: Date, title: string) {
    const { error } = await supabase.from("reminders").insert({
      user_id: userId,
      title,
      body: "This one was scheduled from the app and sent by the server.",
      send_at: sendAt.toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  const inTwoMinutes = () => run(async () => {
    await schedule(new Date(Date.now() + 2 * 60 * 1000), "Scheduled test (2 minutes)");
    return "Scheduled. The server checks every 5 minutes, so it arrives within about 7 minutes.";
  });

  const tomorrowMorning = () => run(async () => {
    const day = berlinTomorrow(new Date());
    const when = berlinLocalToUtc({ ...day, hour: 7, minute: 30 });
    await schedule(when, "Good morning (test briefing)");
    return `Scheduled for tomorrow at 07:30 Berlin time (${fmt(when.toISOString())}).`;
  });

  const lastReceived = log.find((row) => row.received_at);

  return (
    <main className="page">
      <header className="top">
        <h1>Little Wins</h1>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <p className="muted">Milestone 1: prove that a reminder reaches your iPhone.</p>

      <section className="card">
        <h2>Setup checklist</h2>
        <ul className="steps">
          <Step
            ok={installed}
            title="Opened from the Home Screen icon"
            hint={
              isIos()
                ? "In Safari tap Share, then Add to Home Screen. Close Safari and open Little Wins from the new icon."
                : "Install the app from your browser menu, then open it from the icon."
            }
          />
          <Step ok={supported} title="This browser supports push" hint="On iPhone this needs iOS 16.4 or newer and the Home Screen app." />
          <Step
            ok={permission === "granted"}
            title="Notifications allowed"
            hint={permission === "denied" ? "Blocked. Turn Notifications on for Little Wins in iPhone Settings." : "Tap the button below."}
          />
          <Step ok={subscribed} title="This device is registered with the server" hint="Tap Turn on notifications." />
        </ul>
        <button className="primary" onClick={turnOn} disabled={busy || !supported || !installed}>
          Turn on notifications
        </button>
        {!installed && <p className="hint">Notifications can only be turned on from the Home Screen app.</p>}
      </section>

      <section className="card">
        <h2>Tests</h2>
        <div className="buttons">
          <button onClick={sendNow} disabled={busy || !subscribed}>Send a test now</button>
          <button onClick={inTwoMinutes} disabled={busy || !subscribed}>Schedule one in 2 minutes</button>
          <button onClick={tomorrowMorning} disabled={busy || !subscribed}>Schedule tomorrow 07:30</button>
        </div>
        {message && <p className="ok">{message}</p>}
        {problem && <p className="error">{problem}</p>}
        <p className="hint">No notifications are sent between 22:30 and 07:00. A reminder due at night waits until 07:00.</p>
      </section>

      <section className="card">
        <h2>Last push received</h2>
        <p className="big">{lastReceived?.received_at ? fmt(lastReceived.received_at) : "Nothing received yet"}</p>
        {log.length > 0 && (
          <ul className="list">
            {log.map((row) => (
              <li key={row.id}>
                <span>{row.title}</span>
                <span className="muted">
                  sent {fmt(row.sent_at)} · {row.received_at ? "arrived" : "not confirmed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reminders.length > 0 && (
        <section className="card">
          <h2>Scheduled reminders</h2>
          <ul className="list">
            {reminders.map((row) => (
              <li key={row.id}>
                <span>{row.title}</span>
                <span className="muted">{fmt(row.send_at)} · {row.sent_at ? "sent" : "waiting"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
