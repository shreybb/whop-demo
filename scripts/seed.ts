/**
 * Seed helper.
 *
 * Sellers and listings are now created by the marketplace owner from the
 * dashboard (Add seller / Add listing), so there is no fake seed data to insert —
 * this avoids `@example.com` sellers that Whop rejects as non-deliverable.
 *
 * Run with:  npm run seed   (kept so the command doesn't error; verifies DB access)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env first.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // Sanity-check DB connectivity so `npm run seed` still gives useful feedback.
  const { error } = await supabase.from("sellers").select("id").limit(1);
  if (error) {
    console.error("Could not reach the DB / schema not applied:", error.message);
    console.error("Run supabase/schema.sql first.");
    process.exit(1);
  }
  console.log("DB reachable. No demo data seeded by design.");
  console.log("Add sellers and listings from the dashboard:");
  console.log("  → /dashboard  (Add seller → Onboard on Whop → Add listing → Publish → Buy)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
