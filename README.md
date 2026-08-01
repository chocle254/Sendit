# Sendit

A Daraja (M-Pesa) gateway for developers — no Daraja app of your own required.
Sign up, tell Sendit where your money should end up, get an API key, then call
one endpoint to trigger STK push prompts to your customers. Sendit handles the
Daraja plumbing, pays you out automatically, and gates usage behind a free
tier, purchasable tokens, or a monthly/yearly plan.

## How it works

Sendit has exactly one Daraja app — its own. Developers never hand over any
Daraja credentials; they only say *where their money should go* (a phone
number, till, or paybill).

1. A developer signs up and links a payout destination on **Linked accounts**
   — a phone number, till, or paybill (+ account number for paybills). This
   is free and gives 25 STK pushes right away.
2. They call `POST /api/v1/stkpush` with `Authorization: Bearer <api_key>` to
   trigger an STK prompt to their customer's phone.
3. **Collection**: Sendit's own Daraja app (`PLATFORM_*` credentials) sends
   the STK push. When the customer enters their PIN, the money lands in
   **Sendit's own paybill/till**.
4. **Payout**: the instant that collection succeeds, Sendit deducts its fee
   (`fee_bps`, e.g. 2%) and immediately fires a second Daraja call — B2C to a
   phone, or B2B to a till/paybill — moving the net amount to the developer.
5. Both legs are recorded on one transaction row and forwarded to any
   webhook URLs the developer has registered, in real time.

### Usage limits and upgrading

Every `/api/v1/stkpush` call is gated by `evaluateAccountUsage()` in
`lib/db.js` before Sendit ever calls Daraja. In order, an account can send a
push if:

1. it has an **active monthly/yearly plan** (`plan_expires_at` in the
   future) — unlimited pushes for the life of the plan;
2. otherwise, if it has **free-tier transactions left** (25 total, tracked
   by `free_tx_used`);
3. otherwise, if it has a **token balance** (`token_balance >= 1`) —
   1 token = 1 extra transaction.

If none of those hold, the endpoint returns **HTTP 402** with a message
telling the developer to subscribe or buy tokens — the API key itself is
still valid, only usage is blocked. From the **Linked accounts** page, each
account has an "Activate / buy tokens" panel:

- **Monthly** (KES 500) / **Yearly** (KES 5,000) — unlimited pushes for
  30/365 days. Paying again while a plan is still active extends it rather
  than restarting the clock.
- **Tokens** — buy any amount ≥ 25 (1 token = 1 KES = 1 transaction credit).
  Tokens also double as the parole penalty buffer (see below), so they're
  worth keeping topped up even on a plan.

Separately, accounts with 25+ consecutive failed pushes go **on parole**
(`on_parole`) and get charged a 25-token penalty per further failure until
an admin lifts it (`liftParole`) — this is meant to throttle broken
integrations retrying blindly, not normal usage.

This collect-then-disburse pattern is the same one aggregator gateways like
Kopokopo, Pesapal, and IntaSend use — funds are only ever briefly "Sendit's"
between the two Daraja calls.

## Setup

### 1. Database

Provision a Postgres database (Vercel Postgres, Neon, or Supabase all work).
Then run `schema.sql` against it once — it's idempotent, so it's also safe
to re-run after pulling updates that add new columns/tables.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `POSTGRES_URL` (or `SUPABASE_DB_URL`) — your Postgres connection string
- `SESSION_SECRET` — any long random string, signs the login session cookie
- `BASE_URL` — your deployed URL, no trailing slash — used to build every
  Daraja callback URL
- `PLATFORM_CONSUMER_KEY` / `PLATFORM_CONSUMER_SECRET` / `PLATFORM_SHORTCODE` / `PLATFORM_PASSKEY`
  — **your own** Daraja app credentials, used for every STK collection
  (free-tier pushes, subscription payments, token purchases, and every
  developer's customer payments). Get these from
  https://developer.safaricom.co.ke. For testing, sandbox shortcode `174379`
  and Safaricom's published sandbox passkey work with `PLATFORM_ENV=sandbox`.
- `PLATFORM_INITIATOR_NAME` / `PLATFORM_INITIATOR_PASSWORD` / `PLATFORM_CERT_PATH`
  — authorize the payout leg (B2C/B2B) that follows every successful
  collection. The initiator is a portal user with the "Business API Org
  Initiator" role; the cert is Safaricom's public certificate, used to
  encrypt the initiator password into a `SecurityCredential`. See
  `.env.example` for exact download links.

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

Before handling real money, you'll also want to:

- Move to Safaricom's **production** Daraja app (`PLATFORM_ENV=production`)
  and complete Safaricom's go-live process.
- Add rate limiting to `/api/v1/stkpush` and the callback routes.
- Add retry/alerting for a payout that fails to start (currently just marked
  `payout_status = 'failed'` for manual follow-up — see `triggerPayout()` in
  `pages/api/v1/callback/[accountId].js`).
- Consider proper business registration and payment-service-provider
  compliance for your jurisdiction — reselling M-Pesa collection as a paid
  service is a regulated activity in Kenya.

## File map

- `lib/daraja.js` — Daraja OAuth + STK push + collection callback parsing
- `lib/darajaPayout.js` — B2C/B2B payout requests + SecurityCredential encryption + payout callback parsing
- `lib/db.js` — all Postgres queries, including usage gating (`evaluateAccountUsage`) and plan/token logic
- `lib/auth.js` — password hashing + signed session cookies
- `pages/api/account/link.js` — links a developer's payout destination (phone/till/paybill)
- `pages/api/account/subscribe.js` + `subscription-callback.js` — monthly/yearly plan purchase
- `pages/api/account/buy-tokens.js` + `token-purchase-callback.js` — token purchase (extra transactions)
- `pages/api/v1/stkpush.js` — the public API developers call to trigger a customer STK push
- `pages/api/v1/callback/[accountId].js` — Safaricom → records the collection, triggers the payout leg, forwards to webhooks
- `pages/api/v1/payout-callback/[accountId].js` — Safaricom → records the payout result, forwards to webhooks
- `pages/dashboard/*` — overview, linked accounts (+ activation/tokens panel), transactions, webhooks
