"use client";

import { useState, useTransition } from "react";
import {
  approveCompletion,
  rejectDelivery,
  type ApproveResult,
} from "@/app/orders/actions";

/** Buyer's decision pair for a delivered order: approve, or send back. */
export function ApprovalActions({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ApproveResult | null>(null);

  const run = (fn: () => Promise<ApproveResult>) =>
    startTransition(async () => setResult(await fn()));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => run(() => approveCompletion(orderId))}
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "…" : "Approve"}
      </button>
      <button
        onClick={() => run(() => rejectDelivery(orderId))}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-foreground disabled:opacity-50"
      >
        Request changes
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
