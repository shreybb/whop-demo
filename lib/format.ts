/** Small presentational helpers shared by the dashboard. */

export function formatMoney(
  cents: number | null | undefined,
  currency = "usd",
): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortId(id: string | null | undefined, head = 8): string {
  if (!id) return "—";
  return id.length > head ? `${id.slice(0, head)}…` : id;
}

/**
 * Strip internal operation prefixes ("Whop <op> failed:", possibly nested)
 * from error text before it reaches a consumer-facing surface. Full raw
 * errors still go to server logs at the point of failure.
 */
export function sanitizeWhopError(message: string): string {
  let out = message;
  const prefix = /^Whop \S+(?: \([^)]*\))? failed:\s*/;
  while (prefix.test(out)) out = out.replace(prefix, "");
  return out.replace(/^\d{3} \{.*\}$/s, "Something went wrong on Whop's side. Try again shortly.");
}
