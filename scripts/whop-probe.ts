/**
 * Read-only capability probe. Makes NO mutations — only GETs — to see what the
 * configured WHOP_API_KEY is authorized for. Run: npx tsx scripts/whop-probe.ts
 */
import "dotenv/config";
import Whop from "@whop/sdk";

const apiKey = process.env.WHOP_API_KEY;
const companyId = process.env.WHOP_COMPANY_ID;
if (!apiKey) {
  console.error("WHOP_API_KEY missing in .env");
  process.exit(1);
}

const client = new Whop({ apiKey });

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    const res = await fn();
    console.log(`✓ ${label}:`, JSON.stringify(res).slice(0, 300));
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.log(`✗ ${label}: ${err.status ?? ""} ${err.message ?? String(e)}`.trim());
  }
}

async function main() {
  console.log("Probing (read-only)…\n");
  await probe("accounts.me()", () => client.accounts.me());
  if (companyId) {
    await probe(`companies.retrieve(${companyId})`, () =>
      client.companies.retrieve(companyId),
    );
  }
  // List a couple of resources to see read scopes (no writes).
  await probe("products.list (first 1)", () => client.products.list({ first: 1 } as never));
  await probe("plans.list (first 1)", () => client.plans.list({ first: 1 } as never));
  await probe("payoutMethods.list", () =>
    client.payoutMethods.list({ first: 1 } as never),
  );
  console.log("\nDone. ✓ = allowed, ✗ = blocked (status/message shown).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
