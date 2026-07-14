import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  actionToTargetState,
  toCents,
  isTerminal,
  CHAIN,
} from "../lib/state-machine";

test("forward transitions along the chain are allowed", () => {
  assert.equal(canTransition("pending", "paid"), true);
  assert.equal(canTransition("paid", "in_progress"), true);
  assert.equal(canTransition("in_progress", "completed"), true);
  assert.equal(canTransition("completed", "paid_out"), true);
});

test("skipping forward is allowed (still forward, e.g. a missed intermediate event)", () => {
  assert.equal(canTransition("pending", "in_progress"), true);
  assert.equal(canTransition("paid", "paid_out"), true);
});

test("backward transitions are never allowed (out-of-order delivery no-ops)", () => {
  assert.equal(canTransition("paid", "pending"), false);
  assert.equal(canTransition("completed", "paid"), false);
  assert.equal(canTransition("paid_out", "in_progress"), false);
});

test("a state cannot transition to itself (duplicate delivery no-ops)", () => {
  for (const s of CHAIN) assert.equal(canTransition(s, s), false);
});

test("any non-terminal state can drop to a terminal branch", () => {
  assert.equal(canTransition("pending", "failed"), true);
  assert.equal(canTransition("paid", "refunded"), true);
  assert.equal(canTransition("completed", "failed"), true);
});

test("terminal states are final and never transition again", () => {
  assert.equal(isTerminal("failed"), true);
  assert.equal(isTerminal("refunded"), true);
  assert.equal(canTransition("failed", "paid"), false);
  assert.equal(canTransition("refunded", "completed"), false);
  assert.equal(canTransition("failed", "refunded"), false);
});

test("actionToTargetState maps Whop actions to order states", () => {
  assert.equal(actionToTargetState("payment.succeeded"), "paid");
  assert.equal(actionToTargetState("app_payment.succeeded"), "paid");
  assert.equal(actionToTargetState("payment.failed"), "failed");
  assert.equal(actionToTargetState("refund.created"), "refunded");
  assert.equal(actionToTargetState("refund.updated"), "refunded");
  // No state change for these:
  assert.equal(actionToTargetState("payment.pending"), null);
  assert.equal(actionToTargetState("membership.went_valid"), null);
  assert.equal(actionToTargetState("dispute.created"), null);
});

test("toCents converts decimal currency amounts to integer cents", () => {
  assert.equal(toCents(29.99), 2999);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(100), 10000);
  assert.equal(toCents(19.9), 1990);
  assert.equal(toCents(null), null);
  assert.equal(toCents(undefined), null);
  assert.equal(toCents(NaN), null);
});
