/**
 * Centralized, validated access to server-side secrets.
 * Fail fast with a clear message rather than letting an undefined key surface
 * as an opaque "invalid signature" or "unauthorized" deep inside the SDK.
 *
 * IMPORTANT: this module must only ever be imported from server code
 * (route handlers, server components, scripts). None of these values are
 * prefixed NEXT_PUBLIC_, so Next.js will not bundle them into the client.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill it in (see README).`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  whopApiKey: () => required("WHOP_API_KEY"),
  whopWebhookSecret: () => required("WHOP_WEBHOOK_SECRET"),
  whopCompanyId: () => required("WHOP_COMPANY_ID"),
  // The SDK's TS type requires appId (used by its oauth module). We don't use
  // oauth, so it's optional in practice — default to the public app id if set.
  whopAppId: () => optional("WHOP_APP_ID", optional("NEXT_PUBLIC_WHOP_APP_ID", "app_placeholder")),
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: () => optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
};
