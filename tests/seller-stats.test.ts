import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSellerStats } from "../lib/seller-stats";

test("empty inputs produce zeroed stats", () => {
  assert.deepEqual(computeSellerStats([], []), {
    activeOrders: 0,
    earnedCents: 0,
    paidOutCents: 0,
  });
});

test("active = paid + in_progress only", () => {
  const stats = computeSellerStats(
    [
      { state: "pending", amount_cents: 100 },
      { state: "paid", amount_cents: 200 },
      { state: "in_progress", amount_cents: 300 },
      { state: "failed", amount_cents: 400 },
      { state: "refunded", amount_cents: 500 },
    ],
    [],
  );
  assert.equal(stats.activeOrders, 2);
  assert.equal(stats.earnedCents, 0);
});

test("earned counts completed and paid_out order value, tolerating null amounts", () => {
  const stats = computeSellerStats(
    [
      { state: "completed", amount_cents: 1500 },
      { state: "paid_out", amount_cents: 2500 },
      { state: "completed", amount_cents: null },
      { state: "paid", amount_cents: 9900 },
    ],
    [],
  );
  assert.equal(stats.earnedCents, 4000);
});

test("paid out sums only ledger rows with status=sent", () => {
  const stats = computeSellerStats(
    [],
    [
      { status: "sent", amount_cents: 1000 },
      { status: "pending", amount_cents: 2000 },
      { status: "failed", amount_cents: 3000 },
      { status: "sent", amount_cents: 500 },
    ],
  );
  assert.equal(stats.paidOutCents, 1500);
});
