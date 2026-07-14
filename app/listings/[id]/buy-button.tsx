"use client";

import { useState, useTransition } from "react";
import { buyListing, type BuyResult } from "@/app/listings/actions";

export function BuyButton({ listingId }: { listingId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BuyResult | null>(null);

  function buy() {
    startTransition(async () => {
      const r = await buyListing(listingId);
      setResult(r);
      if (r.ok && r.url) {
        // Whop checkout opens in a new tab; the order page tracks the rest.
        window.open(r.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={buy}
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating checkout…" : "Buy now"}
      </button>
      {result && (
        <span
          className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}
        >
          {result.message}{" "}
          {result.ok && (
            <a href="/orders" className="underline hover:text-foreground">
              View your order →
            </a>
          )}
        </span>
      )}
    </div>
  );
}
