/**
 * Standalone verification of the publish + checkout path with the fixed params.
 * Creates ONE test product + one-time plan + checkout config on your own company
 * (clearly labeled, safe to delete). Run: npx tsx scripts/verify-publish.ts
 */
import "dotenv/config";
import Whop from "@whop/sdk";

const apiKey = process.env.WHOP_API_KEY;
const companyId = process.env.WHOP_COMPANY_ID;
if (!apiKey || !companyId) {
  console.error("WHOP_API_KEY / WHOP_COMPANY_ID missing");
  process.exit(1);
}
const client = new Whop({ apiKey });

async function main() {
  console.log("1) products.create …");
  const product = await client.products.create({
    company_id: companyId!,
    title: "TEST — verify publish (safe to delete)",
  });
  console.log("   ✓ product", product.id);

  console.log("2) plans.create (one_time) …");
  const plan = await client.plans.create({
    company_id: companyId!,
    product_id: product.id,
    plan_type: "one_time",
    release_method: "buy_now",
    currency: "usd",
    initial_price: 5,
  });
  console.log("   ✓ plan", plan.id, "purchase_url:", (plan as { purchase_url?: string }).purchase_url);

  console.log("3) checkoutConfigurations.create (with metadata) …");
  const checkout = await client.checkoutConfigurations.create({
    plan_id: plan.id,
    metadata: { order_id: "test-order", listing_id: "test-listing", seller_id: "test-seller" },
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`,
  });
  console.log("   ✓ checkout purchase_url:", checkout.purchase_url);

  console.log("\nALL THREE SUCCEEDED. Test product id (delete when done):", product.id);
}

main().catch((e: unknown) => {
  const err = e as { status?: number; message?: string };
  console.error("✗ FAILED:", err.status ?? "", err.message ?? String(e));
  process.exit(1);
});
