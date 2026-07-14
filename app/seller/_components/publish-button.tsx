"use client";

import { useState, useTransition } from "react";
import { publishMyListing, type Result } from "@/app/seller/actions";

export function PublishButton({ listingId }: { listingId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() =>
          startTransition(async () => setResult(await publishMyListing(listingId)))
        }
        disabled={pending}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-foreground disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish"}
      </button>
      {result && !result.ok && (
        <span className="text-xs text-red-700">{result.message}</span>
      )}
    </span>
  );
}
