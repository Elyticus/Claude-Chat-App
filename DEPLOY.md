# Deploying Linkloop to production

Linkloop is a **split deploy**:

```
Browser ──> Netlify (React static site, dist/)
              │  /api + /socket.io  (HTTPS / WSS)
              ▼
            Render (Express + Socket.io)  ──>  Postgres
                                          ──>  S3/R2 bucket (attachments)
                                          ──>  Anthropic API (AI features)
                                          ──>  SMTP (sign-up codes)
```

- **Backend** (`server/`) → **Render** web service, configured by [`render.yaml`](render.yaml).
- **Frontend** (`dist/`) → **Netlify** static site, configured by [`netlify.toml`](netlify.toml).

Everything below is one-time setup. After it's wired up, **every push to `main` auto-deploys**
both sides.

> The app runs end-to-end on free tiers. The only thing that *needs* a paid plan is
> always-on uptime — see [Notes](#notes--caveats).

---

## 0. Prerequisites (accounts — all have free tiers)

| What | Used for | Where |
|---|---|---|
| **Postgres** | the database | [Neon](https://neon.tech) / [Supabase](https://supabase.com) / Render Postgres |
| **S3-compatible bucket** | media & voice uploads | [Cloudflare R2](https://developers.cloudflare.com/r2/) (recommended) or AWS S3 |
| **Anthropic API key** | AI features | https://console.anthropic.com → API keys |
| **SMTP** | sign-up verification emails | a Gmail [App Password](https://myaccount.google.com/apppasswords) |
| **Render** + **Netlify** | hosting | render.com / netlify.com (connect your GitHub) |

Collect these values first; you'll paste them into the Render/Netlify dashboards in steps 5–6.

---

## 1. Provision Postgres

Create a database and copy its connection string. It must look like:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

That's your **`DATABASE_URL`**. The schema is created automatically on first boot
(`initDb()` in `server/db.js`) — no migrations to run by hand.

> If startup times out on a cold managed DB, raise `DB_CONNECT_TIMEOUT_MS` (e.g. `20000`).

## 2. Create the storage bucket (Cloudflare R2 shown)

1. R2 → **Create bucket** (e.g. `linkloop-uploads`). Keep it **private** — the app
   streams files through its own auth-gated route, so the bucket never needs public access.
2. R2 → **Manage API Tokens** → create a token with **Object Read & Write** on that bucket.
3. Note these four values:
   - `S3_BUCKET` = the bucket name
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` = the token's keys
   - `S3_REGION` = `auto` (already defaulted in `render.yaml`)

> **AWS S3 instead?** Create a bucket + an IAM user with `s3:PutObject`/`GetObject`/`DeleteObject`
> on it. Leave `S3_ENDPOINT` **unset** and set `S3_REGION` to the real region (e.g. `us-east-1`).

## 3. SMTP (Gmail App Password)

1. Enable 2-Step Verification on the Google account.
2. https://myaccount.google.com/apppasswords → generate a 16-character app password.
3. You'll use: `SMTP_USER` = your address, `SMTP_PASS` = that app password,
   `SMTP_FROM` = e.g. `Linkloop <you@gmail.com>`. (`SMTP_HOST`/`SMTP_PORT` are
   already defaulted to Gmail in `render.yaml`.)

## 4. Merge to `main`

Render/Netlify deploy from `main`. The Pro work is on `feature/linkloop-pro`:

```sh
cd "Claude/C. Chat App"
git checkout main
git merge --no-ff feature/linkloop-pro
git push origin main
```

*(Or open a PR `feature/linkloop-pro → main` on GitHub and merge it.)*

---

## 5. Deploy the backend (Render)

1. Render → **New** → **Blueprint** → pick the `Elyticus/Claude-Chat-App` repo. Render reads
   `render.yaml` and creates the **chatloop-server** web service. `JWT_SECRET` and
   `BILLING_WEBHOOK_SECRET` are auto-generated; the `sync:false` vars are left blank.
2. Open the service → **Environment** and fill in the blanks from steps 1–3:
   `DATABASE_URL`, `ANTHROPIC_API_KEY`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (and `VAPID_*` if you want push).
3. Deploy. When it's live, copy the service URL, e.g. `https://chatloop-server.onrender.com`.
   Hit `https://<that-url>/api/health`-style routes or watch the logs for
   `Linkloop server → …`, `[storage] object storage → bucket "…"`, and no `[ai] … disabled` warning.

> Leave **`CLIENT_ORIGIN`** as-is for now — you'll set it in step 7 once you have the Netlify URL.

## 6. Deploy the frontend (Netlify)

1. Netlify → **Add new site** → **Import** the same repo. Build settings come from
   `netlify.toml` (`npm run build` → publish `dist`).
2. Site → **Environment variables** → add, pointing at your Render URL from step 5:
   ```
   VITE_API_URL      = https://chatloop-server.onrender.com/api
   VITE_SOCKET_URL   = https://chatloop-server.onrender.com
   VITE_VAPID_PUBLIC_KEY = <same as VAPID_PUBLIC_KEY on Render, if using push>
   ```
3. **Trigger a deploy** (Vite inlines these at build time, so they must be set *before* the build).
   Copy the resulting site URL, e.g. `https://linkloop.netlify.app`.

## 7. Close the CORS loop

Back on **Render → chatloop-server → Environment**, set:

```
CLIENT_ORIGIN = https://linkloop.netlify.app
```

Save (Render redeploys). This is the only browser origin allowed to call the API / open the
socket. **Done** — open the Netlify URL and use the app.

---

## 8. Post-deploy smoke test

- [ ] **Sign up** a new account → verification code arrives by email → log in.
- [ ] **Send messages** between two accounts in real time (confirms Socket.io/WSS).
- [ ] **Upload** an image and a voice note → they render → **redeploy Render** → reopen:
      they still load (confirms object storage, not ephemeral disk).
- [ ] **AI**: "Catch me up" returns a summary; smart-reply chips appear; `/ask …` answers;
      translate a message.
- [ ] **Billing**: hit a Pro-gated feature on a free account → upgrade modal → mock checkout →
      plan flips to Pro → gates unlock.
- [ ] **Search**: Cmd/Ctrl-K → results across rooms (Pro) vs current-room-only (free).

---

## Notes & caveats

- **Free-tier cold starts.** Render's free web service sleeps after ~15 min idle; the next
  request waits ~50s while it wakes. For always-on, upgrade that one service to a paid
  instance (no code change). Postgres/R2/Anthropic free tiers are fine as-is.
- **Billing is a self-contained mock.** Checkout is a built-in HMAC-signed webhook flip — no
  real card processor. To take real money, swap the mock in `server/billing.js` for Stripe
  Checkout + a verified `stripe-webhook` endpoint; the plan-gating layer stays unchanged.
- **JWT in `localStorage`.** Acceptable here; for hardening, move to httpOnly cookies + refresh
  rotation (noted in `server/CLAUDE.md`).
- **Native mobile app** (`mobile/`) is separate: point its `mobile/.env` API base at the Render
  URL and rebuild with EAS. It doesn't send a browser `Origin`, so `CLIENT_ORIGIN` doesn't affect it.
