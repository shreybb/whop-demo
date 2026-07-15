import { CHAIN, RANK, TERMINAL } from "@/lib/state-machine";
import type { OrderState } from "@/lib/orders";

const LABELS: Record<string, string> = {
  pending: "Order placed",
  paid: "Payment confirmed",
  in_progress: "Work started",
  awaiting_approval: "Delivered — approve it",
  completed: "Approved",
  paid_out: "Seller paid",
};

/**
 * Linear progress through the order chain, driven by the same
 * state-machine module the webhook uses — one source of truth.
 * Terminal branches (failed / refunded) render as a flat notice instead.
 */
export function OrderTimeline({ state }: { state: OrderState }) {
  if (TERMINAL.has(state)) {
    return (
      <p className="text-sm text-red-700">
        This order ended in <span className="font-medium">{state}</span>.
      </p>
    );
  }

  const rank = RANK[state] ?? 0;
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {CHAIN.map((step, i) => {
        const done = i <= rank;
        return (
          <li key={step} className="flex items-center gap-2">
            {i > 0 && (
              <span
                aria-hidden
                className={`h-px w-6 ${done ? "bg-foreground" : "bg-border"}`}
              />
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs ${
                done
                  ? "bg-foreground font-medium text-white"
                  : "border border-border bg-white text-muted-foreground"
              }`}
            >
              {LABELS[step] ?? step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
