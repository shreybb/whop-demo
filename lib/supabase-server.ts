import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Request-scoped Supabase client that carries the logged-in user's JWT
 * (from the auth cookies) and therefore RESPECTS RLS.
 *
 * Use this for every buyer/seller read and for seller listing drafts.
 * Privileged work (webhooks, Whop calls, admin, cross-tenant writes) stays on
 * the service-role client in `lib/supabase.ts`.
 *
 * Must be called per-request (it reads request cookies) — never memoize it.
 */
export function getSupabaseAuth(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. Safe to ignore: middleware
          // refreshes the session, so tokens never go stale from here.
        }
      },
    },
  });
}
