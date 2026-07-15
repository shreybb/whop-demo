# Written scenarios

For each: issue type, customer reply, internal action, urgency, evidence,
escalation call. Several are problems I hit myself while building the
prototype, noted below.

---

## Scenario 1: Buyer paid, order still pending

Customer says: "A buyer paid for a listing, but our marketplace still says
the order is pending. Is Whop broken?"

Issue type: Webhook delivery or processing gap. The payment went through; the
signal about it didn't land. Likely causes: webhook URL/secret out of sync
after a redeploy, signature verification rejecting deliveries, the handler
erroring on a valid event, or missing order_id in checkout metadata.

Customer reply:

Hi! First, the important part: if the payment shows succeeded, your buyer's
money is safe. Webhook events are retried and replayable, so this should
resolve without anyone re-paying.

Three quick checks. Does your event log show a payment.succeeded event for
this payment, and any error on it? In the Whop dashboard under Developer >
Webhooks, are recent deliveries 200s, 401s, or timing out? Any recent
redeploy? A rotated webhook secret is the most common cause.

Send me the payment ID and rough time and I'll trace it in parallel.

Internal action: Confirm the payment succeeded in Whop, check delivery
attempts and response codes. 401s point to secret handling. I hit this exact
issue in the build: the secret needs base64 encoding before verification, and
@whop/api's validator rejects v1 REST deliveries outright. 200s with no state
change point to a handler bug, usually metadata mapping. Write up the root
cause for their runbook.

Urgency: High. Usually means every order is affected. Same-day, reassure
early.

Evidence: Payment ID and timestamp, delivery attempts with status codes,
event log rows for that webhook-id, whether metadata carried order_id, recent
deploys or secret rotations.

Escalate to engineering: Usually no, most of these are integration-side.
Escalate only if Whop never fired the event, or deliveries fail Whop-side.
Then send payment ID, expected event type, endpoint config, delivery logs.

---

## Scenario 2: Seller cannot receive payouts

Customer says: "The seller completed onboarding, but they still can't
withdraw. This is blocking launch."

Issue type: Onboarding complete isn't the same as payout-ready. Three gates
must all be true: KYC approved (not just submitted), a payout method attached
(portal-only, no API, withdrawals fail without it), and settled funds. I hit
all three in the build.

Customer reply:

Hi! Let's get this unblocked today. This is almost always one of three setup
gates, not something broken, and none should move your launch date.

Verification approved: submitted isn't approved, review is async, I'll check
the current status. Payout method on file: the seller adds this in their
payouts portal, onboarding alone doesn't, it takes a couple minutes. Settled
funds: recent earnings may still be in the settlement window.

Send me the seller's account ID and I'll tell you which gate within the
hour.

Internal action: Pull verification status, payout methods, and settled vs
pending balance via the API (lib/whop-platform.ts does this). Reply with the
specific gate. Then fix the systemic issue: their UI should show payout
readiness, not just "onboarding complete." Share the not_started /
pending_kyc / ready mapping from this build.

Urgency: High, treat as launch-blocking regardless of how simple the fix is.
Diagnosis within the hour.

Evidence: Account ID, verification status and timestamps, payout methods on
file, settled vs pending balance, exact error and Whop error code.

Escalate to engineering: Only if all three gates pass and it still fails.
Then send account ID, withdrawal request/response with error code,
timestamps. Sandbox note: it rejects ledger transfers outright ("Sends are
only supported from an Ethereum wallet"), an environment limitation, not a
customer bug.

---

## Scenario 3: 401 on connected account API key

Customer says: "We created a connected seller, but all api calls return 401
errors."

Issue type: Auth model mix-up, not an outage. The platform key authenticates
all calls involving connected accounts; creating one doesn't mint a separate
key. Common trip-up for teams used to other platforms. Secondary: wrong
header format, sandbox key against prod URL.

Customer reply:

Hi! This is a quick fix, and a common trip-up.

You keep using your platform API key for calls involving sellers. The
connected account isn't a separate credential; you reference its account ID
in the request, authenticated with your platform key.

Check: are the failing calls using your platform key, not something from
seller creation? Is it sent as Authorization: Bearer <key>? Does the key
match the environment, since a sandbox key against the prod URL causes
exactly this?

Still failing? Send me one failing request (method, path, headers with the
key redacted) and I'll reproduce it and send back a working example.

Internal action: Probably reproduce their call shape in my own sandbox (I have a
known-good reference per endpoint from the build). Confirm their key has
connected-accounts permissions, send a working curl, add an auth-model note
to their runbook.

Urgency: Medium. Blocks development but deterministic, usually one exchange.
Same-day with a working example.

Evidence: One failing request (method, full URL, redacted headers), key type
and origin, connected account ID, full 401 response body.

Escalate to engineering: Almost never, this is education plus an example.
Escalate only if a valid, permissioned platform key still 401s reproducibly.
Then send request ID, timestamp, key prefix, my own failing reproduction.

---

## Scenario 4: Dashboard request

Customer says: "We need one dashboard showing buyer payment, order state,
seller payout status, webhook delivery, and errors. Without this, our ops
team is blind."

Issue type: Feature request, not a bug. This turns scenarios 1-3 into
30-second lookups. It's built on their own data: Whop is the source of truth
for money, their database for orders, the dashboard reconciles the two.

Customer reply:

Agreed, and good news: you already have every data source this situation needs!

Buyer payment comes from payment/refund webhooks, persisted. Order state is
your orders table, driven by those events. Seller payout status comes from
polling verification and payout-method status via the API, with one ledger
row per payout. Webhook delivery and errors come from logging every inbound
event before processing, with ID, type, signature validity, processed flag,
error, and the order it touched. That last one is what turns "paid but
pending" into a lookup instead of an investigation.

I've built exactly this: one screen, orders joined to their event history,
payout status, and a replay button. Happy to walk your ops team through it
this week. One suggestion: give errored events a replay action instead of a
ticket path, it makes most incidents self-service.

Internal action: Share the reference (/admin: orders, webhook_events log,
payouts ledger, replay) and its schema, set up a session with their ops/eng
leads. File the underlying need as product feedback to Whop.

Urgency: Medium. Nothing's down, but it gates launch confidence and every
future incident's resolution time. Deliver this week.

Evidence: Their current schema, which events they persist today, their ops
team's top questions during an incident.

Escalate to engineering: No, this is solution architecture. Product feedback
goes to Whop product, not engineering.
