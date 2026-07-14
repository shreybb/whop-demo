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
