-- CreatorJobs schema. Run in the Supabase SQL editor (or `psql`) before starting the app.
-- Minimal by design: no RLS for the demo (all access is server-side via the service role key).
-- Every `create`/`alter` here is idempotent, so re-running it on an existing DB is safe and
-- additive (it picks up new columns/tables without touching existing rows).

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
  currency text not null default 'usd',                -- snapshot at checkout, so the order is self-describing
  refunded_amount_cents int,                           -- set when a refund.* event lands
  whop_refund_id text,                                 -- Whop refund id from that event
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Payout ledger. One row per order paid out, so the money leaving the platform is
-- auditable and payouts are idempotent (unique order_id => a retry can't double-pay).
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) unique not null,  -- unique = idempotency guard
  seller_id uuid references sellers(id) not null,
  whop_withdrawal_id text unique,                       -- Whop withdrawal id (null until sent)
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null default 'pending',               -- pending | sent | failed
  error text,                                           -- failure reason, for reconciliation
  created_at timestamptz default now()
);

-- Idempotency + audit log for every webhook Whop sends us.
create table if not exists webhook_events (
  id text primary key,                 -- Whop `webhook-id` header -> dedup key
  type text not null,                  -- event action, e.g. payment.succeeded
  payload jsonb not null,              -- raw parsed body (or raw text on signature failure)
  signature_valid boolean not null,
  processed boolean not null default false,
  error text,
  order_id uuid references orders(id), -- resolved order (for per-order reconciliation), null if unmatched
  received_at timestamptz default now()
);

-- Additive migrations for databases created before the columns above existed.
alter table orders add column if not exists currency text not null default 'usd';
alter table orders add column if not exists refunded_amount_cents int;
alter table orders add column if not exists whop_refund_id text;
alter table webhook_events add column if not exists order_id uuid references orders(id);

-- Helpful indexes for the dashboard queries.
create index if not exists orders_listing_id_idx on orders (listing_id);
create index if not exists orders_state_idx on orders (state);
create index if not exists listings_seller_id_idx on listings (seller_id);
create index if not exists payouts_seller_id_idx on payouts (seller_id);
create index if not exists webhook_events_received_at_idx on webhook_events (received_at desc);
create index if not exists webhook_events_processed_idx on webhook_events (processed);
create index if not exists webhook_events_order_id_idx on webhook_events (order_id);

-- ============================================================================
-- Auth & tenancy (Supabase Auth, magic-link).
--
-- One login serves three personas. A `profiles` row mirrors each auth user;
-- `role` stays NULL until the user picks buyer/seller at /onboarding/role.
-- Admin is never self-selectable: promote by hand with
--   update profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text check (role in ('buyer', 'seller', 'admin')),  -- null = not chosen yet
  created_at timestamptz default now()
);

-- Auto-create a profile the first time someone completes a magic-link login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tie the marketplace tables to identities.
alter table sellers add column if not exists profile_id uuid unique references profiles(id);
alter table orders add column if not exists buyer_id uuid references profiles(id);
-- Delivered work (seller attaches on completion; buyer sees it on the order page).
alter table orders add column if not exists deliverable_note text;
alter table orders add column if not exists deliverable_url text;

create index if not exists orders_buyer_id_idx on orders (buyer_id);
create index if not exists sellers_profile_id_idx on sellers (profile_id);

-- ============================================================================
-- Row Level Security.
--
-- Two clients exist server-side:
--   * service-role (lib/supabase.ts)        -> bypasses RLS. Webhooks, Whop
--     calls, admin reads, and any write that must cross tenants.
--   * request-scoped JWT (lib/supabase-server.ts) -> respects RLS. All
--     buyer/seller page reads and seller listing drafts.
--
-- Writes that touch Whop or the state machine stay in server actions that
-- verify ownership in code and then execute via service-role; RLS is the
-- defense-in-depth read guard.
-- ============================================================================

alter table profiles enable row level security;
alter table sellers enable row level security;
alter table listings enable row level security;
alter table orders enable row level security;
alter table payouts enable row level security;
alter table webhook_events enable row level security;  -- no policies: service-role only

-- Who am I? (Profiles are readable only by their owner; role changes go through
-- a service-role server action so users can't self-promote to admin.)
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select using (id = auth.uid());

-- Sellers see their own seller row (payout status, connected-account id).
drop policy if exists sellers_select_own on sellers;
create policy sellers_select_own on sellers
  for select using (profile_id = auth.uid());

-- Listings: the marketplace storefront is public for published rows;
-- sellers manage (and see) their own drafts.
drop policy if exists listings_select_published on listings;
create policy listings_select_published on listings
  for select using (whop_plan_id is not null);

drop policy if exists listings_all_own on listings;
create policy listings_all_own on listings
  for all using (
    seller_id in (select id from sellers where profile_id = auth.uid())
  )
  with check (
    seller_id in (select id from sellers where profile_id = auth.uid())
  );

-- Orders: buyers see their purchases; sellers see orders on their listings.
drop policy if exists orders_select_buyer on orders;
create policy orders_select_buyer on orders
  for select using (buyer_id = auth.uid());

drop policy if exists orders_select_seller on orders;
create policy orders_select_seller on orders
  for select using (
    listing_id in (
      select l.id from listings l
      join sellers s on s.id = l.seller_id
      where s.profile_id = auth.uid()
    )
  );

-- Payouts: sellers can read their own payout ledger rows.
drop policy if exists payouts_select_seller on payouts;
create policy payouts_select_seller on payouts
  for select using (
    seller_id in (select id from sellers where profile_id = auth.uid())
  );
