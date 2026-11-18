# Little Wins – milestone 1: a reminder that reaches your iPhone

This first version only proves the hard part: login, an installable Home Screen app, and push notifications (instant, scheduled, and a 07:30 Berlin morning test).

## 1. Supabase (database + login)
1. Create a free project at supabase.com.
2. SQL Editor → paste the content of `supabase/schema.sql` → Run.
3. Authentication → Sign In / Providers → Email: turn **off** "Allow new users to sign up" (this app is only for you).
4. Authentication → Users → Add user → your email + a strong password (tick "Auto confirm").
5. Project Settings → API: copy the **Project URL**, the **anon key** and the **service_role key** (keep the last one secret).

## 2. Push keys
Run once on any computer with Node: `npx web-push generate-vapid-keys`. You get a public and a private key.

## 3. Netlify
1. Put this folder in a private GitHub repository.
2. Netlify → Add new site → Import from GitHub. Build settings come from `netlify.toml`.
3. Site configuration → Environment variables (mark the private ones as secret):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (secret)
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` = your keys (private one secret)
   - `VAPID_SUBJECT` = `mailto:your@email`
4. Deploy. The 5-minute scheduler only runs on the production deploy.

## 4. iPhone (iOS 16.4+)
1. Open your Netlify address in **Safari**.
2. Share → **Add to Home Screen**.
3. Close Safari and open **Little Wins from the new icon**.
4. Sign in (again – the Home Screen app has its own storage).
5. Tap **Turn on notifications** → Allow.
6. Tap **Send a test now**, then **Schedule one in 2 minutes**, lock the phone and wait (up to ~7 min).
7. Set **Schedule tomorrow 07:30** and check the next morning.

## Troubleshooting
- Button disabled: you are not in the Home Screen app.
- "server has no push key": `VAPID_PUBLIC_KEY` missing; redeploy after adding variables.
- Sent but "not confirmed": check iPhone Settings → Notifications → Little Wins, and that Focus/Do Not Disturb is off.
- Nothing scheduled arrives: the scheduler runs only on production deploys; check Netlify → Functions → send-due logs.

## Develop locally
`npm install`, `npm test`, `npm run build`. Use `netlify dev` to run functions locally.
