import { WhopServerSdk, makeWebhookValidator } from "@whop/api";
import { env } from "@/lib/env";

/**
 * Whop SDK client for the platform account (CreatorJobs).
 *
 * We use `@whop/api` (the package named in the spec). It exposes the
 * server SDK plus `makeWebhookValidator`. Created lazily so imports don't
 * throw at build time when env vars are absent.
 */
let sdk: ReturnType<typeof WhopServerSdk> | null = null;

export function getWhop() {
  if (sdk) return sdk;
  sdk = WhopServerSdk({
    appApiKey: env.whopApiKey(),
    appId: env.whopAppId(),
    companyId: env.whopCompanyId(),
  });
  return sdk;
}

/**
 * Webhook validator. Reads the raw body + signature headers off the Request,
 * verifies the HMAC against WHOP_WEBHOOK_SECRET, and returns the parsed,
 * type-safe event body. Throws if the signature is missing or invalid.
 */
let validator: ReturnType<typeof makeWebhookValidator> | null = null;

export function getWebhookValidator() {
  if (validator) return validator;
  validator = makeWebhookValidator({ webhookSecret: env.whopWebhookSecret() });
  return validator;
}
