"use client";

import { useState, useTransition } from "react";
import { getMyAccountLink, type Result } from "@/app/seller/actions";

export function PayoutPortalButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function open() {
    startTransition(async () => {
      const r = await getMyAccountLink("payouts_portal");
      setResult(r);
      if (r.ok && r.url) window.open(r.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={open}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-foreground disabled:opacity-50"
      >
        {pending ? "Opening…" : "Manage payout methods ↗"}
      </button>
      {result && !result.ok && (
        <span className="text-xs text-red-700">{result.message}</span>
      )}
    </span>
  );
}
