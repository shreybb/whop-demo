/**
 * Sandbox-only testing helper: starts a prefilled individual (KYC)
 * verification for a connected account and prints the hosted session_url to
 * complete it, so `payout_status` can reach "ready" without hand-typing
 * through the hosted flow's identity fields every time.
 *
 * Uses `POST /verifications` (docs.whop.com/developer/verification/overview)
 * — not in the installed @whop/sdk@0.0.40 (that's a newer "beta" endpoint),
 * so this calls the REST API directly. Test values are Whop's own documented
 * example identity, not a real person's data.
 *
 * Refuses to run unless WHOP_BASE_URL points at the sandbox, since this
 * creates a fake identity verification — never run against production.
 *
 * Usage: npx tsx scripts/sandbox-verify-seller.ts <biz_connected_account_id>
 */
import "dotenv/config";

const accountId = process.argv[2];
if (!accountId) {
  console.error("Usage: npx tsx scripts/sandbox-verify-seller.ts <biz_...>");
  process.exit(1);
}

const baseUrl = process.env.WHOP_BASE_URL ?? "";
if (!baseUrl.includes("sandbox")) {
  console.error(
    "WHOP_BASE_URL is not pointed at the sandbox — refusing to run. " +
      "This creates a test identity verification and must never touch production.",
  );
  process.exit(1);
}

async function main() {
  const res = await fetch(`${baseUrl}/verifications?account_id=${accountId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "individual",
      first_name: "Jane",
      last_name: "Doe",
      date_of_birth: "1995-01-15",
      country: "US",
      tax_identification_number: "123-45-6789",
      address: {
        line1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        postal_code: "94105",
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.error("Failed:", JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("Verification:", body.id, "| status:", body.status);
  if (body.session_url) {
    console.log("\nOpen this to complete it (sandbox provider — test uploads pass):");
    console.log(body.session_url);
  } else {
    console.log("No session_url — already", body.status);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
