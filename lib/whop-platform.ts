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

/** Create a Whop connected account (sub-merchant) for a seller. */
export async function createConnectedAccount(input: {
  name: string;
  email: string;
}): Promise<{ companyId: string }> {
  try {
    const company = await getWhopRest().companies.create({
      title: input.name,
      email: input.email,
      parent_company_id: env.whopCompanyId(), // enroll under the CreatorJobs platform
    });
    return { companyId: company.id };
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
): Promise<{ payoutStatus: "not_started" | "pending_kyc" | "ready" }> {
  try {
    const account = await getWhopRest().payoutAccounts.retrieve(companyId);
    return { payoutStatus: mapPayoutStatus(account.status) };
  } catch (err) {
    if (err instanceof Whop.NotFoundError) {
      return { payoutStatus: "not_started" };
    }
    throw wrap("getConnectedAccountStatus", err);
  }
}

function mapPayoutStatus(
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

/** Manual payout to a connected account. */
export async function payoutConnectedAccount(input: {
  companyId: string;
  amountCents: number;
  currency: string;
}): Promise<{ withdrawalId: string }> {
  try {
    const withdrawal = await getWhopRest().withdrawals.create({
      company_id: input.companyId,
      amount: input.amountCents / 100,
      currency: input.currency as never,
      platform_covers_fees: true,
    });
    return { withdrawalId: withdrawal.id };
  } catch (err) {
    throw wrap("payoutConnectedAccount", err);
  }
}

function wrap(op: string, err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[whop-platform] ${op} failed:`, message);
  return new Error(`Whop ${op} failed: ${message}`);
}
