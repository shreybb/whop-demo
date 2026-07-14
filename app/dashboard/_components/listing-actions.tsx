"use client";

import { useState, useTransition } from "react";
import { publishListing, buyListing, type Result } from "@/app/dashboard/platform-actions";

export function ListingActions({
  listingId,
  published,
}: {
  listingId: string;
  published: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function publish() {
    startTransition(async () => setResult(await publishListing(listingId)));
  }

  function buy() {
    const email = window.prompt("Buyer email (optional):", "buyer@example.com") ?? "";
    startTransition(async () => {
      const r = await buyListing(listingId, email);
      setResult(r);
      if (r.ok && r.url) window.open(r.url, "_blank", "noopener");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1">
        {!published ? (
          <button
            onClick={publish}
            disabled={pending}
            className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {pending ? "…" : "Publish to Whop"}
          </button>
        ) : (
          <button
            onClick={buy}
            disabled={pending}
            className="rounded-md border border-border bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "…" : "Buy (checkout)"}
          </button>
        )}
      </div>
      {result && (
        <span className={`text-[11px] ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
