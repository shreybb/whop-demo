import Whop from "@whop/sdk";
import { getWhopRest } from "@/lib/whop-sdk";
import { env } from "@/lib/env";

/**
 * Thin, typed wrappers around the Whop platform (Experimental) operations.
 * Every call is wrapped so failures surface as clean Errors the server actions
 * can catch and show, rather than leaking SDK internals.
 *
 * NOTE: These require a Whop *platform* API key with connected-accounts enabled.
 * They are wired correctly but can only be exercised against live credentials.
 */

/**
 * Create a Whop connected account (sub-merchant) for a seller.
 *
 * Experimental-first: the beta Accounts API (`accounts.create` +
 * `Api-Version-Date`) creates a connected account implicitly under the API
 * key's platform account — no `parent_company_id` needed (verified live: the
 * response carries `parent_account_id` automatically). `title` postdates the
 * pinned SDK's types, hence the cast; the API accepts it.
 *
 * DOCUMENTED SANDBOX BLOCKER: beta account creation provisions a crypto
 * wallet via Privy, and the sandbox's Privy tenant is capped — requests
 * validate but die with "Privy API error (400): max_accounts_reached". On
 * any create failure, fall back to the Stable `companies.create` (which
 * skips wallet provisioning) so onboarding never breaks.
 */
export async function createConnectedAccount(input: {
  name: string;
  email: string;
}): Promise<{ companyId: string; via: "accounts" | "companies" }> {
  const rest = getWhopRest();
  const beta = { headers: { "Api-Version-Date": "2026-07-08-1" } };
  try {
    const account = await rest.accounts.create(
      {
        email: input.email,
        title: input.name,
        metadata: { source: "creatorjobs_onboarding" },
      } as Parameters<typeof rest.accounts.create>[0],
      beta,
    );
    return { companyId: account.id, via: "accounts" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      "[whop-platform] Experimental accounts.create errored:",
      message.slice(0, 200),
    );
  }

  // CONFIRMED LIVE: the beta create is NOT atomic. On the Privy cap it
  // persists the account, THEN returns 400 — so blindly retrying (or falling
  // back to companies.create) double-creates / collides on the name. Recover
  // the phantom account by email+title before creating anything else.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = await (rest.accounts.list as any)(null, beta);
    const phantom = ((list.accounts ?? []) as Array<{ id: string; email?: string; title?: string }>).find(
      (a) => a.email === input.email && a.title === input.name,
    );
    if (phantom) {
      console.warn(
        "[whop-platform] recovered account persisted by the failed beta create:",
        phantom.id,
      );
      return { companyId: phantom.id, via: "accounts" };
    }
  } catch {
    // Listing is best-effort; fall through to the Stable create.
  }

  try {
    const company = await rest.companies.create({
      title: input.name,
      email: input.email,
      parent_company_id: env.whopCompanyId(), // enroll under the CreatorJobs platform
    });
    return { companyId: company.id, via: "companies" };
  } catch (err) {
    throw wrap("createConnectedAccount", err);
  }
}

/**
 * Generate a hosted, time-limited link for a connected account:
 *  - "account_onboarding" -> KYC / verification
 *  - "payouts_portal"     -> manage payout methods & view payouts
 */
export async function createAccountLink(input: {
  companyId: string;
  useCase: "account_onboarding" | "payouts_portal";
}): Promise<{ url: string; expiresAt: string }> {
  const base = env.appUrl();
  try {
    const link = await getWhopRest().accountLinks.create({
      company_id: input.companyId,
      use_case: input.useCase,
      // Sellers land back in their portal after hosted KYC / payout setup.
      return_url: `${base}/seller`,
      refresh_url: `${base}/seller`,
    });
    return { url: link.url, expiresAt: link.expires_at };
  } catch (err) {
    throw wrap("createAccountLink", err);
  }
}

/**
 * Read a connected account's payout readiness so we can sync `payout_status`.
 *
 * Payout readiness is NOT a `Company` field — `companies.retrieve` has no
 * `payouts_enabled`/`charges_enabled` (that was a guess this project made
 * before verifying against the real schema; those fields don't exist
 * anywhere in `@whop/sdk`'s types). The real source of truth is the
 * `payoutAccounts` resource, keyed by the same connected-account id, whose
 * `status` is the actual KYC/withdrawal-readiness signal. It 404s until the
 * seller starts hosted onboarding — that's `not_started`, not an error.
 */
export async function getConnectedAccountStatus(
  companyId: string,
  payoutAccountId?: string | null,
): Promise<{ payoutStatus: "not_started" | "pending_kyc" | "ready" }> {
  try {
    // Retrieve is keyed by the poact_ id (captured from webhooks); retrieving
    // by company id 404s even when the payout account exists — confirmed live.
    const account = await getWhopRest().payoutAccounts.retrieve(
      payoutAccountId || companyId,
    );
    return { payoutStatus: mapPayoutStatus(account.status) };
  } catch (err) {
    if (err instanceof Whop.NotFoundError) {
      return { payoutStatus: "not_started" };
    }
    throw wrap("getConnectedAccountStatus", err);
  }
}

export function mapPayoutStatus(
  status: Whop.PayoutAccountCalculatedStatuses | null,
): "not_started" | "pending_kyc" | "ready" {
  switch (status) {
    case "connected":
      return "ready";
    case "pending_verification":
    case "action_required":
    case "verification_failed":
    case "disabled":
      return "pending_kyc";
    case "not_started":
    case null:
    default:
      return "not_started";
  }
}

/**
 * The platform's ledger balances. Buyer payments settle here first (sellers
 * are paid from this pool), and the sandbox holds proceeds in
 * `pending_balance` before releasing them — payouts fail with a confusing
 * error unless the UI surfaces that settling state.
 */
export async function getPlatformBalance(): Promise<{
  availableCents: number;
  pendingCents: number;
}> {
  try {
    const ledger = await getWhopRest().ledgerAccounts.retrieve(env.whopCompanyId());
    const usd = (ledger.balances ?? []).find((b) => b.currency === "usd");
    return {
      availableCents: Math.round((usd?.balance ?? 0) * 100),
      pendingCents: Math.round((usd?.pending_balance ?? 0) * 100),
    };
  } catch (err) {
    throw wrap("getPlatformBalance", err);
  }
}

/** Create a Whop product + one-time plan for a listing. Returns their ids. */
export async function createListingProductAndPlan(input: {
  title: string;
  description?: string | null;
  priceCents: number;
  currency: string;
}): Promise<{ productId: string; planId: string; purchaseUrl: string | null }> {
  const rest = getWhopRest();
  try {
    const product = await rest.products.create({
      company_id: env.whopCompanyId(),
      title: input.title,
    });
    const plan = await rest.plans.create({
      company_id: env.whopCompanyId(),
      product_id: product.id,
      // One-time (single charge). Omitting plan_type defaults to "renewal",
      // which then requires a non-zero billing_period. `initial_price` is the
      // full price for a one-time plan; no renewal_price/billing_period.
      plan_type: "one_time",
      release_method: "buy_now",
      currency: input.currency as never,
      initial_price: input.priceCents / 100, // Whop uses decimal currency units
      description: input.description ?? undefined,
    });
    return {
      productId: product.id,
      planId: plan.id,
      purchaseUrl: (plan as { purchase_url?: string }).purchase_url ?? null,
    };
  } catch (err) {
    throw wrap("createListingProductAndPlan", err);
  }
}

/**
 * Create a per-order checkout carrying our mapping metadata. The returned
 * purchase_url is where the buyer completes payment; on success Whop fires a
 * payment.succeeded webhook whose metadata lets us advance the order.
 */
export async function createCheckoutForOrder(input: {
  planId: string;
  orderId: string;
  listingId: string;
  sellerId: string;
}): Promise<{ purchaseUrl: string }> {
  try {
    const config = await getWhopRest().checkoutConfigurations.create({
      plan_id: input.planId,
      metadata: {
        order_id: input.orderId,
        listing_id: input.listingId,
        seller_id: input.sellerId,
      },
      // Buyers come back to their orders after paying on Whop.
      redirect_url: `${env.appUrl()}/orders`,
    });
    return { purchaseUrl: config.purchase_url };
  } catch (err) {
    throw wrap("createCheckoutForOrder", err);
  }
}

/**
 * Pay out a seller. Experimental-first with a Stable fallback:
 *
 * 1. `transfers.create` (Experimental) — a ledger transfer from the
 *    platform's balance to the seller's Whop balance. This is the method
 *    Whop's own platform quickstart uses to pay sub-merchants, and it needs
 *    no payout method: sellers cash out to their bank on their own schedule
 *    via the hosted portal. `idempotence_key` = our order id, so even if the
 *    payouts-ledger claim ever raced, Whop itself would dedupe.
 *
 * 2. `withdrawals.create` (Stable) — DOCUMENTED SANDBOX BLOCKER FALLBACK.
 *    The sandbox rejects ledger transfers in every documented form ("Sends
 *    are only supported from an Ethereum wallet" — with/without `type`,
 *    biz_/ldgr_ origins, every supported Api-Version-Date up to 2026-07-08-1)
 *    even though the current docs and quickstart say this exact call works.
 *    Until that ships, fall back to a Stable withdrawal, which pushes to an
 *    external payout method (must exist — hosted-portal-only to add) and
 *    requires `payout_method_id` at runtime despite the SDK typing it
 *    optional (also confirmed live).
 */
export async function payoutConnectedAccount(input: {
  companyId: string;
  amountCents: number;
  currency: string;
  orderId: string;
}): Promise<{ transferId: string; via: "transfer" | "withdrawal" }> {
  const rest = getWhopRest();
  try {
    const transfer = await rest.transfers.create({
      origin_id: env.whopCompanyId(),
      destination_id: input.companyId,
      amount: input.amountCents / 100,
      currency: input.currency as never,
      idempotence_key: input.orderId,
      metadata: { order_id: input.orderId, reason: "creatorjobs_seller_payout" },
      notes: "CreatorJobs order payout",
    });
    return { transferId: transfer.id, via: "transfer" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Only the specific sandbox gap falls through; real failures still throw.
    if (!message.includes("Ethereum wallet")) {
      throw wrap("payoutConnectedAccount", err);
    }
    console.warn(
      "[whop-platform] Experimental ledger transfer unavailable in this environment; falling back to Stable withdrawal.",
    );
  }

  let payoutMethodId: string;
  try {
    const methods = await rest.payoutMethods.list({ company_id: input.companyId });
    const items = methods.data ?? [];
    const method = items.find((m) => m.is_default) ?? items[0];
    if (!method) {
      throw new Error(
        "No payout method on file yet. Add one via the payout portal, then try again.",
      );
    }
    payoutMethodId = method.id;
  } catch (err) {
    throw wrap("payoutConnectedAccount (looking up payout method)", err);
  }

  try {
    const withdrawal = await rest.withdrawals.create({
      company_id: input.companyId,
      amount: input.amountCents / 100,
      currency: input.currency as never,
      payout_method_id: payoutMethodId,
      platform_covers_fees: true,
    });
    return { transferId: withdrawal.id, via: "withdrawal" };
  } catch (err) {
    throw wrap("payoutConnectedAccount", err);
  }
}

function wrap(op: string, err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[whop-platform] ${op} failed:`, message);
  return new Error(`Whop ${op} failed: ${message}`);
}
