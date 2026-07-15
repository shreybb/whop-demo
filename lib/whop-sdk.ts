import Whop from "@whop/sdk";
import { env } from "@/lib/env";

/**
 * `@whop/sdk` REST client — the only Whop SDK this project depends on. Used
 * for every outbound platform/Experimental call (connected accounts, hosted
 * KYC/payout links, checkout configurations, products/plans, payouts) AND
 * for inbound webhook verification (`webhooks.unwrap()`, see lib/whop.ts).
 *
 * See README "Whop API usage" for why this project used to also depend on
 * `@whop/api`, and why that turned out to be a real blocker for webhooks.
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

/**
 * Per-request opt-in to the Experimental API model. The SDK sends no version
 * header by default (= original 2025-01-01 Stable behavior); passing this pins
 * the newest supported version, per docs.whop.com/developer/api/versioning.
 */
export const BETA = { headers: { "Api-Version-Date": "2026-07-08-1" } } as const;
