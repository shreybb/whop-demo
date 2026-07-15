# CreatorJobs — Whop-powered marketplace prototype

A two-sided marketplace: **buyers** (businesses) pay for freelance work,
**sellers** (creators) deliver it and get paid. Whop powers seller onboarding
(connected accounts + hosted KYC), buyer checkout, payment confirmation
(production-grade webhooks), order state, and payouts. Live at
**whop-demo-two.vercel.app**, running against Whop's **sandbox**.

**Stack:** Next.js 14 (App Router, TS) on Vercel · Supabase (Postgres + Auth,
RLS) · `@whop/sdk` (exact-pinned `0.0.40`) · Tailwind.

---

## Users, auth, and views

Email + password auth (Supabase; signup needs no email verification — demo
choice). One login, three role-scoped experiences chosen at first sign-in:

| Role | Views | Can do |
| --- | --- | --- |
| **Buyer** | `/` storefront, `/orders` | Buy via hosted Whop checkout, track order state, **approve or reject** delivered work |
| **Seller** | `/seller` portal (Overview · Listings · Orders · Payouts · Purchases) | Onboard (connected account → hosted KYC), publish listings, work orders (start → deliver), withdraw after buyer approval; can also buy from other sellers |
| **Admin** | `/admin` console | Read-everything oversight, manual state overrides, webhook log + replay. Promoted by hand in SQL — never self-selectable |

Data isolation is two layers: **explicit ownership filters in every query**
(session-derived ids; the client never sends one) with **RLS as the
cross-tenant backstop**. Two real bugs taught us not to lean on RLS alone: OR'd
policies leaked a seller's purchases into their own work queue, and the
self-read-only `sellers` policy nulled seller names on buyer pages.

## Order state machine

```
pending → paid → in_progress ⇄ awaiting_approval → completed → paid_out
              (any non-terminal) → failed | refunded     (terminal)
```

Pure + unit-tested ([`lib/state-machine.ts`](lib/state-machine.ts)). Forward-only
with exactly one sanctioned reverse edge: a buyer rejecting a delivery sends it
back to `in_progress` for rework. Buyer approval is what unlocks the seller's
withdraw. The guard is enforced in code **and** in SQL
(`UPDATE … WHERE state = <from>`), so concurrent webhook deliveries can't race.

## Webhook pipeline (payment confirmation)

[`app/api/webhooks/whop/route.ts`](app/api/webhooks/whop/route.ts): verify →
idempotent insert → route → guarded transition → always ack.

| Concern | Mechanism |
| --- | --- |
| Signatures | `@whop/sdk` `webhooks.unwrap()` (Standard Webhooks; secret base64-encoded). Invalid → 401 + logged |
| Idempotency | `webhook_events.id` = `webhook-id` header (PK); duplicates 200 no-op. Invalid-signature rows get fresh `invalid_<uuid>` keys so forgeries can't squat a real event's key |
| Ordering | Rank-guarded FSM; late/duplicate events no-op |
| Retry storms | Processing errors ack 200; admin console has per-event **Replay** |
| Order mapping | Checkout metadata `{order_id, listing_id, seller_id}` → payload `metadata.order_id`; fallback lookup by `whop_payment_id` |
| Seller status | `payout_account.status_updated` events drive `sellers.payout_status` and capture the `poact_` id |

Verified live: real sandbox purchases advanced orders to `paid` with correct
amounts; KYC webhooks flipped the seller to `ready`.

## Payouts (money out)

Buyer payments settle to the **platform's** ledger (escrow model); sellers are
paid per order after buyer approval. Each payout claims a row in the `payouts`
ledger (`unique(order_id)`) **before** calling Whop — a retry or double-click
collides instead of double-paying. Primary path is an Experimental **ledger
transfer** into the seller's Whop balance (`idempotence_key` = order id);
Stable **withdrawal** is the fallback (see blockers). UI degrades honestly:
Withdraw greys out while funds settle, with the seller's own owed amount shown
(never platform-wide balances).

---

## Whop API usage — Experimental vs Stable (graded)

"Experimental" is not a separate host: it's the same `/api/v1` opted in via the
`Api-Version-Date` header (shared `BETA` constant, [`lib/whop-sdk.ts`](lib/whop-sdk.ts));
no header = original Stable shapes. Every call that **has** an Experimental
surface leads with it, each with a Stable fallback that records which path ran.

| Call | Tier |
| --- | --- |
| `plans.create` | **Experimental** — Plans has no Stable equivalent at all |
| `transfers.create` (payout) | **Experimental** — see blocker 2 |
| `accounts.create` (onboarding) | **Experimental** — see blocker 3; Stable `companies.create` fallback |
| `products.create`, `checkoutConfigurations.create` | **Experimental**, Stable retry |
| `payoutMethods.list`, KYC status (`GET /verifications`) | **Experimental** first, Stable fallbacks (`payoutAccounts.retrieve(poact_)`) |
| `accountLinks.create`, `withdrawals.create` (fallback), `webhooks.unwrap` | **Stable — no Experimental surface exists** (beta `Create Payout` is stablecoin-only; fiat uses `POST /withdrawals`) |

### Blockers found (all reproduced live, then handled)

1. **`@whop/api` (the spec-named package) rejects real webhook deliveries** —
   `makeWebhookValidator` failed all 8 live deliveries ("Missing header
   containing signature"); it targets a different delivery mechanism than the
   v1 REST webhooks actually sent. Switched to `webhooks.unwrap()`; also fixed
   a masked field bug (amount is `total`, not `final_amount`). `@whop/api`
   dropped entirely.
2. **Sandbox rejects Experimental ledger transfers in every documented form**
   ("Sends are only supported from an Ethereum wallet" — all origins, all
   version dates). Fallback: Stable withdrawal, which itself requires a
   `payout_method_id` (SDK types it optional) that only the hosted portal can
   create — and the sandbox portal doesn't offer the flow.
3. **Beta account creation is non-atomic on the sandbox's capped Privy wallet
   tenant** — the account persists, *then* a 400 returns. Recovery adopts the
   phantom (matching email + title across both response vocabularies,
   `data` vs `accounts`) before falling back. Titles are suffixed with a seller
   id prefix because Whop rejects duplicate account titles.
4. Smaller: `payoutAccounts.retrieve` is keyed by the webhook-supplied `poact_`
   id, not the company id; `companies.retrieve` has no payout-readiness fields;
   hosted checkout's button text isn't configurable (best: `custom_cta:
   "purchase"` on the product); payments settle to `pending_balance` before
   payouts can draw on them.

---

## Quick start

```bash
npm install
cp .env.example .env        # fill in (see below)
# Run supabase/schema.sql in the Supabase SQL editor (idempotent).
npm run dev                 # storefront at :3000, /seller, /admin
npm run typecheck && npm test && npm run build
```

| Var | Purpose |
| --- | --- |
| `WHOP_API_KEY` / `WHOP_COMPANY_ID` | Platform key (all scopes) + company id. Server-only |
| `WHOP_WEBHOOK_SECRET` | Webhook signature secret from the dashboard |
| `WHOP_BASE_URL` | Set to `https://sandbox-api.whop.com/api/v1` for sandbox (own key/company/secret per environment) |
| `WHOP_APP_ID` | Unused oauth module only; may be blank |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Service-role client (webhooks, Whop calls, cross-tenant writes). Server-only |
| `SUPABASE_ANON_KEY` | RLS-respecting auth client (sessions). Server-only here |
| `NEXT_PUBLIC_APP_URL` | Public base URL for checkout/KYC return links |

**Deploy:** Vercel (`vercel --prod`); add the env vars, point a Whop webhook at
`https://<app>/api/webhooks/whop`, subscribe payment/refund/dispute +
payout/KYC lifecycle events.

## Project layout

```
app/
  api/webhooks/whop/route.ts     # webhook endpoint
  (public) page.tsx, listings/   # storefront + buy
  orders/                        # buyer orders, approve/reject
  seller/                        # portal: onboarding, listings, orders, payouts
  admin/                         # ops console: oversight, overrides, replay
  login/, onboarding/role/       # auth + one-time role pick
lib/
  state-machine.ts               # pure FSM (tested)
  orders.ts / process-event.ts   # DB transitions + event routing
  whop-sdk.ts / whop-platform.ts # Whop client, BETA pin, all API wrappers
  payouts.ts / checkout.ts       # idempotent payout + shared checkout cores
  marketplace.ts / seller.ts     # read models   · supabase*.ts / auth.ts
supabase/schema.sql              # schema + RLS (idempotent)
tests/                           # state machine + seller stats (npm test)
```

## Trade-offs (demo scope)

- Signup skips email verification; anyone can register an unowned address.
- The platform takes no commission and covers fees — sellers are paid the full
  order amount (stated design choice, one-line change to add a take rate).
- No dispute/chargeback handling beyond audit-logging the events.
- `npm audit` advisories come from Whop SDK transitive deps; left untouched to
  avoid forcing SDK downgrades.
