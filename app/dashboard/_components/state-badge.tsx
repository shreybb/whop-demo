import { Badge, type Tone } from "@/components/ui/badge";
import type { OrderState } from "@/lib/orders";

const STATE_TONE: Record<OrderState, Tone> = {
  pending: "gray",
  paid: "blue",
  in_progress: "amber",
  completed: "purple",
  paid_out: "green",
  failed: "red",
  refunded: "red",
};

export function StateBadge({ state }: { state: OrderState }) {
  return <Badge tone={STATE_TONE[state] ?? "gray"}>{state.replace(/_/g, " ")}</Badge>;
}

export function PayoutBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "ready" ? "green" : status === "pending_kyc" ? "amber" : "gray";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}
