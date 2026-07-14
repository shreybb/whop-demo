"use client";

import { useState, useTransition } from "react";
import {
  startWork,
  deliverOrder,
  withdrawForOrder,
  type Result,
} from "@/app/seller/actions";
import type { OrderState } from "@/lib/state-machine";

interface Props {
  orderId: string;
  state: OrderState;
  payoutReady: boolean;
}

/**
 * The seller's per-order controls, keyed off the state machine:
 *   paid        -> Start work   (or deliver straight away)
 *   in_progress -> Deliver (note/link form)
 *   completed   -> Withdraw
 */
export function OrderWorkflow({ orderId, state, payoutReady }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [showDeliver, setShowDeliver] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");

  function run(fn: () => Promise<Result>) {
    startTransition(async () => setResult(await fn()));
  }

  if (state === "pending") {
    return <span className="text-xs text-muted-foreground">Awaiting payment</span>;
  }

  if (state === "paid_out" || state === "failed" || state === "refunded") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "paid" && (
          <button
            onClick={() => run(() => startWork(orderId))}
            disabled={pending}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-foreground disabled:opacity-50"
          >
            Start work
          </button>
        )}
        {(state === "paid" || state === "in_progress") && (
          <button
            onClick={() => setShowDeliver((v) => !v)}
            disabled={pending}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-foreground disabled:opacity-50"
          >
            {showDeliver ? "Cancel" : "Deliver…"}
          </button>
        )}
        {state === "completed" && (
          <button
            onClick={() => run(() => withdrawForOrder(orderId))}
            disabled={pending || !payoutReady}
            title={payoutReady ? undefined : "Finish payout setup first"}
            className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Withdrawing…" : "Withdraw"}
          </button>
        )}
      </div>

      {showDeliver && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-gray-50 p-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Delivery note for the buyer…"
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://link-to-the-work (optional)"
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
          />
          <button
            onClick={() =>
              run(async () => {
                const r = await deliverOrder(orderId, note, url);
                if (r.ok) setShowDeliver(false);
                return r;
              })
            }
            disabled={pending}
            className="w-fit rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Delivering…" : "Mark delivered"}
          </button>
        </div>
      )}

      {result && (
        <span className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
