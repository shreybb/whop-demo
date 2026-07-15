# CreatorJobs — Whop-powered marketplace prototype

A minimal two-sided marketplace. **Buyers** pay for freelance work; **sellers** are
Whop connected accounts who get paid out. Whop powers seller onboarding, buyer
checkout, payment confirmation (webhooks), order state, and payouts.

The centerpiece is a **reliable webhook ingestion pipeline** (signature verification,
idempotency, out-of-order handling, an auditable event log with replay), driving a
guarded, forward-only **order state machine**.

- **Stack:** Next.js 14 (App Router, TS) on Vercel · Supabase Postgres (service-role,
  server-only) · `@whop/api` + `@whop/sdk` · Tailwind + lightweight shadcn-style UI.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure secrets
cp .env.example .env      # then fill in the values (see "Environment" below)

# 3. Create the schema
#    Paste supabase/schema.sql into the Supabase SQL editor (or psql) and run it.

# 4. Run
npm run dev               # marketplace at http://localhost:3000 (admin at /admin)

# Checks
npm run typecheck
npm test                  # state-machine unit tests
npm run build
```

### Environment

| Var | Purpose |
| --- | --- |
| `WHOP_API_KEY` | Platform (CreatorJobs) API key. Server-only. |
| `WHOP_WEBHOOK_SECRET` | Verifies incoming webhook signatures. |
| `WHOP_COMPANY_ID` | Platform company id (`biz_…`); parent of connected accounts. |
| `WHOP_APP_ID` | Only used by the SDK's oauth module; safe to leave blank for the demo. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Bypasses RLS — never expose client-side. |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used for checkout/KYC return links. |

---

## Architecture

```
Buyer ──checkout──▶ Whop ──webhook──▶ /api/webhooks/whop ──▶ order state machine ──▶ Supabase
                                            │
Seller ◀── payout ── Whop ◀── withdrawals ──┘        Dashboard reads orders + webhook log
```

- The **platform** Whop account = CreatorJobs. Each **seller** = a Whop **connected
  account** (`companies.create` with `parent_company_id`).
- **Buyers have no Whop account.** They pay through a hosted checkout whose metadata
  carries `{ order_id, listing_id, seller_id }`, so webhook events map back to our rows.

### Order state machine (forward-only, guarded)

```
pending ─▶ paid ─▶ in_progress ─▶ completed ─▶ paid_out
   └──────────── any non-terminal ───────────┘─▶ failed | refunded   (terminal)
```

Rules (see [`lib/state-machine.ts`](lib/state-machine.ts), unit-tested):

- Advance only to a strictly higher rank on the linear chain (forward-only).
- Any non-terminal state may drop into `failed` / `refunded`; terminal states are final.
- Out-of-order or duplicate events **no-op** — never regress, never throw.
- The guard is enforced twice: in code, and again in the SQL `UPDATE … WHERE state = <from>`,
  so concurrent deliveries can't race into a regression.

---

## Component 1 — Webhook ingestion pipeline

Endpoint: [`app/api/webhooks/whop/route.ts`](app/api/webhooks/whop/route.ts) (Node runtime).

Handler flow, in order:

1. **Read raw body, verify signature** with `@whop/api`'s `makeWebhookValidator`
   (`WHOP_WEBHOOK_SECRET`). On failure → log a `webhook_events` row with
   `signature_valid=false` and return **401**.
2. **Idempotent insert** into `webhook_events`, keyed by the Whop **`webhook-id`**
   header. If the row already existed → **200** immediately (duplicate delivery).
3. **Route by `action`.** Payment/refund events resolve to an order via
   `metadata.order_id` (fallback: lookup by `whop_payment_id`) and call the state machine.
4. **Guarded transition.** Late/duplicate/out-of-order events no-op and are marked processed.
5. **On processing error**, record `error` on the event row but still return **200**
   (so Whop doesn't retry-storm); the dashboard surfaces it as unprocessed with a
   **Replay** button.

### Idempotency, ordering, security — how each is handled

| Concern | Mechanism |
| --- | --- |
| Signature verification | `makeWebhookValidator` (HMAC over raw body). Invalid → 401 + logged. |
| Idempotency | `webhook_events.id` = Whop `webhook-id` header (PK). Duplicate insert → 200 no-op. |
| Idempotency-key poisoning | Invalid-signature rows are keyed by a fresh `invalid_<uuid>`, never the claimed `webhook-id`, so a forged request can't squat on a real event's key and get it skipped. |
| Out-of-order delivery | Rank-guarded state machine + `WHERE state = <from>` optimistic update. |
| Retry-storm avoidance | Processing errors are logged and **acked 200**; replayed manually. |
| Auditability | Every event stored with raw payload, `signature_valid`, `processed`, `error`. |

### Testing checklist

- **Garbage signature → 401 + logged row:** `./scripts/test-bad-signature.sh http://localhost:3000`
- **Real Whop test event → 200 + processed row:** send from the Whop dashboard webhook UI.
- **Duplicate event id → second is a no-op:** resend the same event; second returns `{status:"duplicate"}`.
- **Payment event for an already-advanced order → state unchanged:** the state machine no-ops.
- **Unit tests:** `npm test` covers the transition guard, action→state mapping, and amount conversion.

---

## Components 2–4 — Onboarding, checkout, payouts

- **Seller onboarding** ([`lib/whop-platform.ts`](lib/whop-platform.ts)):
  `companies.create` → store `whop_company_id`; `accountLinks.create({ use_case:
  "account_onboarding" })` → hosted KYC link; `syncPayoutStatus` reads the account back.
- **Listings + checkout:** `products.create` + `plans.create` per listing, then a
  per-order `checkoutConfigurations.create({ plan_id, metadata, redirect_url })` whose
  `purchase_url` carries `{ order_id, listing_id, seller_id }`.
- **Payouts:** `accountLinks.create({ use_case: "payouts_portal" })` for the hosted
  portal, and `withdrawals.create` for a direct manual payout (wired to the "Pay out
  seller" action on completed orders). Each payout is written to a **`payouts` ledger**
  (one row per order, `unique(order_id)`) recording the Whop `withdrawal_id`, amount, and
  status — so money leaving the platform is auditable and reconcilable.
  - **Idempotent by construction:** the ledger row is *claimed* (inserted `pending`)
    **before** the withdrawal is issued. A retry or double-click collides on the unique
    `order_id` instead of sending a second withdrawal; on success the row flips to `sent`
    with the withdrawal id, on failure to `failed` (retriable, and visible for reconciliation).

All are driven from the dashboard (Sellers / Listings action buttons). They are wired
correctly against the real SDK types but require a **platform API key with
connected-accounts enabled** to execute end to end.

---

## Whop API usage — Experimental vs Stable (graded)

Every Whop operation in this app — outbound (connected accounts, hosted KYC/payout
links, products/plans, checkout configurations, withdrawals) and inbound (webhook
verification) — goes through **one** package: `@whop/sdk`, the REST client for
Whop's Experimental platform surface (`lib/whop-sdk.ts`, `lib/whop-platform.ts`,
`lib/whop.ts`).

**Blocker found and fixed: `@whop/api` doesn't validate this project's real webhook
deliveries.** The app originally used `@whop/api`'s `makeWebhookValidator` for
webhook signature checking, matching the spec's stated package name. It compiled
fine and looked correct — but a live sandbox purchase proved otherwise: Whop
delivered 3 real webhook events, and `makeWebhookValidator` rejected every one with
`"Missing header containing signature."` `@whop/api` is built for a different
(GraphQL app-webhook) delivery mechanism than the `webhook-id` /
`webhook-timestamp` / `webhook-signature` headers Whop's current v1 REST webhook
system actually sends (confirmed against `docs.whop.com/developer/guides/webhooks`,
which documents `@whop/sdk`'s `webhooks.unwrap()` — a Standard Webhooks verifier —
as the current method). The fix: verify via `@whop/sdk`'s `webhooks.unwrap()`
instead, with the dashboard-issued secret base64-encoded first (per that doc). This
also surfaced a second, quieter bug the type mismatch had been hiding: the payment
amount field is `total`, not `final_amount` — `@whop/api`'s stale typed union had
the wrong field name, so `amount_cents` would have silently written `null` on
every real payment even if signatures had validated. `@whop/api` is no longer a
dependency of this project — one SDK now covers everything.

**Where each call sits (Experimental vs Stable), verified against the docs'
OpenAPI source markers** (`api-v1-stable.json` vs the `/api-reference/beta/`
"Experimental" pages):

| Call | Tier |
| --- | --- |
| `plans.create` (listing pricing) | **Experimental** — the Plans resource has no Stable equivalent at all |
| `transfers.create` (seller payout) | **Experimental** — primary payout path, see blocker below |
| `accounts.create` (seller onboarding) | **Experimental** — primary path, Stable `companies.create` fallback. Sandbox blocker: beta account creation dies on a capped Privy wallet tenant (`max_accounts_reached`) — and NON-ATOMICALLY: the account persists before the 400, so the fallback first recovers the phantom account by email+title before ever double-creating |
| `products.create`, `checkoutConfigurations.create` (checkout) | **Experimental** (`Api-Version-Date` pinned), Stable retry on error |
| `payoutMethods.list`, KYC status (`GET /verifications?account_id=`) | **Experimental** first, Stable `payoutAccounts.retrieve(poact_)` / `company_id`-shape fallbacks |
| `accountLinks.create`, `withdrawals.create` (fallback only), `webhooks.unwrap` | Stable — **no Experimental surface exists**: account links and webhook config/verification have no beta pages, and beta `Create Payout` is stablecoin-only ("Accounts that pay out from a fiat balance use POST /withdrawals") |

**Blocker: Experimental ledger transfers don't work in the sandbox.** Whop's
current platform quickstart pays sub-merchants with `transfers.create`
(`type: "ledger"`, Experimental) — no payout method needed, funds land in the
seller's Whop balance. This app implements exactly that as the primary payout
path. The sandbox, however, rejects it in **every documented form** — with and
without `type`, `biz_`/`ldgr_` origins, every supported `Api-Version-Date` up
to `2026-07-08-1` — always with `"Sends are only supported from an Ethereum
wallet"`, i.e. it routes all transfers to the crypto wallet-send path. Per the
take-home's "note where you had to use Stable": `payoutConnectedAccount`
(`lib/whop-platform.ts`) tries the Experimental transfer first and falls back
to a Stable `withdrawals.create` **only** on that specific error, recording
which path ran. The Stable path has its own documented quirk: it requires
`payout_method_id` at runtime (despite the SDK typing it optional), and payout
methods can only be added via the hosted portal — there's no API for it.

The only mapping approximation is `payout_status`
(`getConnectedAccountStatus`), which coarsely maps the payout account's
calculated status onto `not_started | pending_kyc | ready`.

### API version pinning

- **SDK / API surface** — `@whop/sdk` is pinned to an **exact** version in
  `package.json` (`0.0.40`, no `^`), so the API surface can't drift under us on
  install. The REST client also uses `maxRetries: 2` for transient failures.
- **Webhook payload version** — every captured delivery carries `api_version: "v1"`;
  the `Whop.UnwrapWebhookEvent` union this app parses (`lib/orders.ts`) is generated
  from `@whop/sdk`'s v1 OpenAPI spec, so the two stay in lockstep by construction.

---

## Deploy (Vercel)

1. Push to a Git repo and import into Vercel (framework auto-detected as Next.js).
2. Add all env vars from the table above in **Project → Settings → Environment Variables**.
3. Deploy. The webhook endpoint is `https://<your-app>.vercel.app/api/webhooks/whop`.
4. In the Whop dashboard, create a webhook pointing at that URL and copy its secret into
   `WHOP_WEBHOOK_SECRET`. Send a test event and watch it land in the dashboard log.

> Vercel CLI isn't required, but `npm i -g vercel` unlocks `vercel deploy` / `vercel logs`.

---

## Project layout

```
app/
  api/webhooks/whop/route.ts   # Component 1: the webhook endpoint
  dashboard/                   # Component 5: orders + webhook log + seller/listing ops
    actions.ts                 #   replay + manual state transitions
    platform-actions.ts        #   onboarding / checkout / payout server actions
lib/
  state-machine.ts             # pure, unit-tested transition logic
  orders.ts                    # DB-bound state machine + event→order resolution
  process-event.ts             # shared event processor (route + replay)
  whop.ts                      # @whop/api client + webhook validator
  whop-sdk.ts / whop-platform.ts  # @whop/sdk platform (Experimental) client + wrappers
  supabase.ts · env.ts · queries.ts · format.ts
supabase/schema.sql            # DB schema (run once)
scripts/                       # seed.ts, test-bad-signature.sh
tests/state-machine.test.ts    # unit tests (npm test)
```

## Data model / reconciliation

The schema ([`supabase/schema.sql`](supabase/schema.sql)) models every entity the
marketplace reasons about:

- `sellers`, `listings`, `orders` — the core marketplace, with the order carrying a
  `currency` snapshot and `refunded_amount_cents` / `whop_refund_id` (written when a
  `refund.*` event lands, so a `refunded` order records how much and which Whop refund).
- `payouts` — the payout ledger described above (money out).
- `webhook_events` — the audit log, with a nullable `order_id` linking each processed
  event back to the order it touched, so an order can be reconciled against its full
  event history from the dashboard.

## Notes / trade-offs (4h budget)

- **No dedicated `buyers` table** — buyers have no Whop account, so a buyer is captured as
  `orders.buyer_email`. This denormalization is intentional for the demo; a real build
  would add a `buyers` table once buyers get identity/accounts.
- **No auth / no RLS** on the demo dashboard, by design — all DB access is server-side
  via the service role key.
- `npm audit` reports advisories from transitive deps of the Whop SDKs; not addressed
  here to avoid forcing SDK downgrades.
- Onboarding/checkout/payout flows are wired and type-checked but need live
  connected-accounts credentials to run end to end.
