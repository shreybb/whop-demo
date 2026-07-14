import Whop from "@whop/sdk";
import { env } from "@/lib/env";

/**
 * `@whop/sdk` REST client for platform / Experimental operations that are NOT
 * available in the `@whop/api` GraphQL SDK:
 *   - connected-account creation (companies.create)
 *   - hosted KYC + payout portal links (accountLinks.create)
 *   - checkout configurations with per-order metadata (checkoutConfigurations.create)
 *   - product + plan creation (products.create / plans.create)
 *   - manual payouts (withdrawals.create)
 *
 * See README "Whop API usage" for why two SDKs are used.
 * Lazily constructed so importing this module doesn't require env at build time.
 */
let client: Whop | null = null;

export function getWhopRest(): Whop {
  if (client) return client;
  client = new Whop({
    apiKey: env.whopApiKey(),
    appID: env.whopAppId(),
    // No explicit baseURL: the SDK itself defaults to
    // `process.env.WHOP_BASE_URL ?? "https://api.whop.com/api/v1"`, so setting
    // WHOP_BASE_URL alone (see .env.example) points this whole client at
    // Whop's sandbox without any code change.
    // The API version this client targets is pinned by the exact @whop/sdk
    // version in package.json (0.0.40). Retry idempotent failures for resilience.
    maxRetries: 2,
  });
  return client;
}
