import { makeWebhookValidator } from "@whop/api";
import { env } from "@/lib/env";

/**
 * Whop webhook validator (`@whop/api`).
 *
 * This is the ONLY thing we use `@whop/api` for — it validates the HMAC
 * signature on incoming webhooks and returns the parsed, type-safe event body,
 * throwing if the signature is missing or invalid. All outbound Whop API calls
 * (connected accounts, checkout, payouts) go through `@whop/sdk` — see
 * `lib/whop-sdk.ts`. Created lazily so imports don't require env at build time.
 */
let validator: ReturnType<typeof makeWebhookValidator> | null = null;

export function getWebhookValidator() {
  if (validator) return validator;
  validator = makeWebhookValidator({ webhookSecret: env.whopWebhookSecret() });
  return validator;
}
