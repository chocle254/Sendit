# STK Gateway

A small Daraja (M-Pesa STK Push) wrapper for developers: link a till/paybill,
pay a one-time KES 350 activation fee, get an API key, then call one endpoint
to trigger payment prompts — with a dashboard, transaction history, and
webhooks for your own app.

## How it works

1. A developer signs up and goes to **Linked accounts**.
2. They enter their till/paybill number and their own Daraja app credentials
   (consumer key/secret, shortcode, passkey — from their Safaricom developer account).
3. Submitting the form triggers an STK push for **KES 350**, charged to the
   **platform's own till** (this is how you monetize the gateway).
4. When Safaricom confirms the payment via callback, the account is marked
   `active` and an API key (`sk_live_...`) is generated.
5. The developer calls `POST /api/v1/stkpush` with `Authorization: Bearer <api_key>`
   from their own app to trigger STK pushes against **their own** till, using
   the Daraja credentials they supplied.
6. Results are recorded as transactions and forwarded to any webhook URLs
   they've registered, in real time.

## Setup

### 1. Database (Supabase)

1. Create a project at https://supabase.com.
2. Go to **SQL Editor**, paste in `schema.sql`, and run it once.
3. Go to **Project Settings → Database → Connection string**, select the
   **Transaction** pooler (port `6543`) — this is the one that works well
   with serverless functions — and copy it.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `POSTGRES_URL` — your Supabase pooled connection string from step 1 above
- `SESSION_SECRET` — any long random string
- `BASE_URL` — your deployed URL, e.g. `https://your-app.vercel.app` (no trailing slash)
- `PLATFORM_CONSUMER_KEY` / `PLATFORM_CONSUMER_SECRET` / `PLATFORM_SHORTCODE` / `PLATFORM_PASSKEY`
  — **your own** Daraja app credentials, used only to collect the KES 350
  activation fee. Get these from https://developer.safaricom.co.ke.
  For testing, sandbox shortcode `174379` and Safaricom's published sandbox
  passkey work with `PLATFORM_ENV=sandbox`.

Set the same variables in your Vercel project's Settings → Environment Variables.

### 3. Install and run locally

```bash
npm install
npm run dev
```

Since Daraja needs a public HTTPS callback URL, use a tunnel (e.g. `ngrok http 3000`)
during local testing and set `BASE_URL` to the tunnel URL.

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect the GitHub repo in the Vercel dashboard for automatic deploys.

## Going to production

Before handling real money, you'll want to also:

- Move to Safaricom's **production** Daraja app (`PLATFORM_ENV=production`) and
  complete Safaricom's go-live process for your own till.
- Encrypt `consumer_secret` and `passkey` at rest (they're stored in plaintext
  in this scaffold for clarity — swap in `pgcrypto` or an app-level encryption
  key before launch).
- Add rate limiting to `/api/v1/stkpush` and the callback routes.
- Consider proper business registration and payment-service-provider
  compliance for your jurisdiction — reselling M-Pesa collection as a paid
  service is a regulated activity in Kenya.

## File map

- `lib/daraja.js` — Daraja OAuth + STK push + callback parsing
- `lib/db.js` — all Postgres queries
- `lib/auth.js` — password hashing + signed session cookies
- `pages/api/account/link.js` — starts the KES 350 activation STK push
- `pages/api/account/activation-callback.js` — Safaricom → activates the account + issues the API key
- `pages/api/v1/stkpush.js` — the public API developers call from their own apps
- `pages/api/v1/callback/[accountId].js` — Safaricom → records the transaction + forwards to webhooks
- `pages/dashboard/*` — overview, linked accounts (the paywall flow), transactions, webhooks
