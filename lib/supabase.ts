import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Server-side Supabase client using the service role key.
 *
 * SECURITY: the service role key bypasses RLS and must never reach the browser.
 * Only import this from route handlers, server components, or scripts.
 *
 * Created lazily and memoized so that merely importing this module (e.g. during
 * `next build`) does not throw when env vars are absent.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
