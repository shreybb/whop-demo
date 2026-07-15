"use client";

import { useState, useTransition } from "react";
import { approveCompletion, type ApproveResult } from "@/app/orders/actions";

export function ApproveButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ApproveResult | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => setResult(await approveCompletion(orderId)))
        }
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Approving…" : "Approve delivery"}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
