"use client";

import { useState, useTransition } from "react";
import { advanceOrder, type ActionResult } from "@/app/admin/actions";
import { payoutForOrder } from "@/app/admin/platform-actions";
import type { OrderState } from "@/lib/orders";

// The next forward step a seller/admin can trigger by hand, per current state.
// `paid_out` goes through the real Whop payout, not a bare state change.
const NEXT_STEP: Partial<
  Record<OrderState, { to: OrderState; label: string; payout?: boolean }>
> = {
  paid: { to: "in_progress", label: "Start work" },
  in_progress: { to: "completed", label: "Mark delivered" },
  completed: { to: "paid_out", label: "Pay out seller", payout: true },
};

export function OrderActions({
  orderId,
  state,
}: {
  orderId: string;
  state: OrderState;
}) {
  const step = NEXT_STEP[state];
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (!step) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function onClick() {
    startTransition(async () => {
      const r = step!.payout
        ? await payoutForOrder(orderId)
        : await advanceOrder(orderId, step!.to);
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        {pending ? "…" : step.label}
      </button>
      {result && !result.ok && (
        <span className="text-[11px] text-red-700">{result.message}</span>
      )}
    </div>
  );
}
