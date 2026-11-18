import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configError, supabase } from "./supabase";
import Login from "./Login";
import Home from "./Home";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (configError) {
    return (
      <main className="page">
        <h1>Little Wins</h1>
        <p className="card error">{configError}</p>
      </main>
    );
  }
  if (loading) return <main className="page"><p className="muted">Loading…</p></main>;
  return session ? <Home session={session} /> : <Login />;
}
