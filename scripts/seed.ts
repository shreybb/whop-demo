/**
 * Seed demo sellers, listings, and one sample order.
 *
 * Run with:  npm run seed
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
 *
 * Uses fixed UUIDs + upsert so it is safe to re-run (no duplicates).
 * Standalone (reads process.env directly) so it doesn't depend on Next's
 * path aliases or bundler.
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

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const SELLERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Aisha Rahman",
    email: "aisha@example.com",
    whop_company_id: null,
    payout_status: "ready",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Marco Silva",
    email: "marco@example.com",
    whop_company_id: null,
    payout_status: "pending_kyc",
  },
];

const LISTINGS = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    seller_id: SELLERS[0].id,
    title: "Logo & brand mark",
    description: "A polished logo with two revisions.",
    price_cents: 15000,
    currency: "usd",
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    seller_id: SELLERS[0].id,
    title: "Landing page design",
    description: "Figma design for a single marketing landing page.",
    price_cents: 60000,
    currency: "usd",
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    seller_id: SELLERS[1].id,
    title: "Code review (4h)",
    description: "Deep review of a TypeScript codebase, written report.",
    price_cents: 20000,
    currency: "usd",
  },
];

// One pending order so the dashboard isn't empty and you can fire a test
// webhook whose metadata.order_id points at this row.
const ORDERS = [
  {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    listing_id: LISTINGS[0].id,
    buyer_email: "buyer@example.com",
    state: "pending",
    amount_cents: LISTINGS[0].price_cents,
  },
];

async function main() {
  console.log("Seeding sellers…");
  await upsert("sellers", SELLERS);
  console.log("Seeding listings…");
  await upsert("listings", LISTINGS);
  console.log("Seeding sample order…");
  await upsert("orders", ORDERS);

  console.log("\nDone. Sample order id (use as metadata.order_id in a test webhook):");
  console.log("  " + ORDERS[0].id);
}

async function upsert(table: string, rows: Record<string, unknown>[]) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) {
    console.error(`  Failed to seed ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
