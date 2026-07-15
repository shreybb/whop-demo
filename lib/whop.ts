import { getWhopRest } from "@/lib/whop-sdk";
import { env } from "@/lib/env";
import type Whop from "@whop/sdk";

/**
 * Whop webhook verification via `@whop/sdk`'s `webhooks.unwrap()` — NOT
 * `@whop/api`'s `makeWebhookValidator`, which this project used originally
 * and which turned out to be a real blocker: a live sandbox payment produced
 * three real delivery attempts, and `makeWebhookValidator` rejected every one
 * with "Missing header containing signature." `@whop/api` targets a
 * different (GraphQL app-webhook) delivery mechanism than the `webhook-id` /
 * `webhook-timestamp` / `webhook-signature` headers Whop's current v1 REST
 * webhook system (docs.whop.com/developer/guides/webhooks) actually sends.
 * `webhooks.unwrap()` verifies against the Standard Webhooks spec those
 * headers implement, and is now the only Whop SDK this project depends on.
 *
 * Per docs, the dashboard-issued secret is raw; the verifier expects it
 * base64-encoded.
 */
export function validateWebhookRequest(
  rawBody: string,
  headers: Record<string, string>,
): Whop.UnwrapWebhookEvent {
  return getWhopRest().webhooks.unwrap(rawBody, {
    headers,
    key: Buffer.from(env.whopWebhookSecret()).toString("base64"),
  });
}
