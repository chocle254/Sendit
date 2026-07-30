-- Run this once against your Postgres database (Supabase, Neon, Vercel Postgres, etc.)
-- In Supabase: Project -> SQL Editor -> paste and run.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  business_name text not null,
  till_number text not null,
  shortcode text not null,
  consumer_key text not null,
  consumer_secret text not null,
  passkey text not null,
  api_key text unique,
  status text not null default 'trial', -- trial | active | payment_failed | suspended
  free_tx_used integer not null default 0,
  token_balance integer not null default 0,
  consecutive_failures integer not null default 0,
  on_parole boolean not null default false,
  parole_started_at timestamptz,
  callback_token text unique,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists token_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  delta integer not null,
  reason text not null,
  related_transaction_id uuid,
  created_at timestamptz default now()
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  action text not null,
  admin_note text,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  type text not null, -- 'activation' | 'stkpush'
  checkout_request_id text unique,
  merchant_request_id text,
  phone text,
  amount numeric,
  account_reference text,
  status text not null default 'pending', -- pending | success | failed
  mpesa_receipt text,
  result_desc text,
  created_at timestamptz default now()
);

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  url text not null,
  created_at timestamptz default now()
);

create index if not exists idx_accounts_user on accounts(user_id);
create index if not exists idx_transactions_account on transactions(account_id);
create index if not exists idx_webhooks_account on webhooks(account_id);
create index if not exists idx_token_ledger_account on token_ledger(account_id);
create index if not exists idx_admin_actions_account on admin_actions(account_id);
