# Venue Connect

Meet people from the places you actually go.

1. Someone scans the QR code at a partner venue.
2. They sign in with an email code, pick what they're up for (chat, friends, dating) and their interests, and publish their profile.
3. The profile is visible **only to people who published at the same venue**, for 24 hours (configurable per venue).
4. A mutual like makes a match, which opens an **end-to-end encrypted** chat capped at a few messages (configurable).
5. If they like each other, they share Instagram or WhatsApp. The chat then closes, and its messages are deleted.

Venues pay; it's free for users. Venue admins get a dashboard with their QR code, settings and basic stats.

**Stack:** Next.js 15 (App Router) on Vercel · Supabase (Postgres, Auth, Realtime, Storage) · Tailwind CSS 4 · Lucide icons. The design uses the same liquid-glass language as the Office app.

---

## Setup

### 1. Supabase database

In the Supabase dashboard, open **SQL Editor** and run:

1. `supabase/migrations/0001_init.sql`: tables, row-level security, matching, message cap, storage bucket.
2. *(Optional, recommended)* `supabase/migrations/0002_schedule.sql`: hourly deletion of messages from closed chats. Enable the **pg_cron** extension first (Database → Extensions).

### 2. Supabase auth (email code)

Sign-in uses a 6-digit code typed into the app, not a clickable link. A code works even if the email opens in a different browser than the one the person scanned the QR code with.

- **Authentication → Sign In / Providers → Email:** make sure it's enabled.
- **Authentication → Emails → Templates → Magic Link:** include the code, for example:

  ```html
  <h2>Your Venue Connect code</h2>
  <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
  ```

  Do the same for the **Confirm signup** template.
- **Authentication → URL Configuration:** set the **Site URL** to your deployed app URL.
- For real traffic, set up custom SMTP (Authentication → Emails → SMTP). Supabase's built-in sender is heavily rate-limited.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in (Supabase → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://srhfkcwguwuftrgfwagi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # anon / publishable key (public, safe in the browser)
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

Never put the `service_role` / secret key in this app.

### 4. Run locally

```bash
npm install
npm run dev
```

### 5. Add a venue

1. Sign in to the app once with the venue owner's email.
2. Edit `supabase/seed_example.sql` (slug, name, owner email) and run it in the SQL Editor.
3. The owner opens `/admin` to see stats, change settings and download the QR code.

The venue's public page is `/v/<slug>`. That's what the QR code points to.

### 6. Deploy on Vercel

Import the repo in Vercel, add the three environment variables, and deploy. Then update the Supabase **Site URL** and `NEXT_PUBLIC_SITE_URL` to the production domain.

---

## How it works

| Piece | Where |
|---|---|
| Schema, security rules, RPCs | `supabase/migrations/0001_init.sql` |
| Venue landing / publish | `src/app/v/[slug]` |
| Browse, like, pass | `src/app/v/[slug]/browse` |
| Matches list | `src/app/matches` |
| Encrypted chat | `src/app/chat/[id]`, `src/lib/crypto.ts` |
| Venue admin (stats, QR, settings) | `src/app/admin` |

**Privacy and safety**
- Profiles are only visible to people with an active profile at the same venue, and only to those with at least one matching intent.
- Exact location is never collected; the venue is known only because you scanned its QR code.
- Block hides both people from each other and closes any chat. Report also blocks.
- Users can delete their account (and everything attached to it) from the Profile page.
- Message cap, contact-share limit and chat expiry are enforced in the database, not just in the UI.

**End-to-end encryption**
- Each browser generates an ECDH P-256 key pair. The private key is non-extractable and stays in that browser's IndexedDB.
- Matched people derive a shared AES-256-GCM key (ECDH + HKDF, salted with the match id). The server stores only ciphertext.
- MVP limitations: keys are per device, so signing in on a new device can't read older messages. The server distributes public keys, so there is no key-fingerprint verification yet.

**Photos** are stored in a public Supabase Storage bucket under random file names, resized in the browser to 800px before upload.
