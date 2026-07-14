-- CreatorJobs schema. Run in the Supabase SQL editor (or `psql`) before starting the app.
-- Minimal by design: no RLS for the demo (all access is server-side via the service role key).

create extension if not exists "pgcrypto";

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  whop_company_id text unique,                        -- connected account id (biz_...)
  payout_status text not null default 'not_started',  -- not_started | pending_kyc | ready
  created_at timestamptz default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id) not null,
  title text not null,
  description text,
  price_cents int not null,
  currency text not null default 'usd',
  whop_product_id text,
  whop_plan_id text,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) not null,
  buyer_email text,
  state text not null default 'pending',               -- pending|paid|in_progress|completed|paid_out|failed|refunded
  whop_payment_id text unique,
  amount_cents int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Idempotency + audit log for every webhook Whop sends us.
create table if not exists webhook_events (
  id text primary key,                 -- Whop `webhook-id` header -> dedup key
  type text not null,                  -- event action, e.g. payment.succeeded
  payload jsonb not null,              -- raw parsed body (or raw text on signature failure)
  signature_valid boolean not null,
  processed boolean not null default false,
  error text,
  received_at timestamptz default now()
);

-- Helpful indexes for the dashboard queries.
create index if not exists orders_listing_id_idx on orders (listing_id);
create index if not exists orders_state_idx on orders (state);
create index if not exists listings_seller_id_idx on listings (seller_id);
create index if not exists webhook_events_received_at_idx on webhook_events (received_at desc);
create index if not exists webhook_events_processed_idx on webhook_events (processed);
