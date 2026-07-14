"use client";

import { useState, useTransition } from "react";
import { createListing, type Result } from "@/app/admin/platform-actions";

interface SellerOption {
  id: string;
  name: string;
}

export function NewListingForm({ sellers }: { sellers: SellerOption[] }) {
  const [sellerId, setSellerId] = useState(sellers[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createListing(sellerId, title, Number(price));
      setResult(r);
      if (r.ok) {
        setTitle("");
        setPrice("");
      }
    });
  }

  if (sellers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-white p-3 text-xs text-muted-foreground">
        Add a seller first, then you can create listings for them.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-white p-3"
    >
      <label className="flex flex-col text-xs text-muted-foreground">
        Seller
        <select
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          className="mt-1 w-40 rounded-md border border-border px-2 py-1 text-sm text-foreground"
        >
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Logo design"
          className="mt-1 w-48 rounded-md border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Price (USD)
        <input
          type="number"
          min="1"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="150"
          className="mt-1 w-28 rounded-md border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add listing"}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </form>
  );
}
