"use client";

import { useState, useTransition } from "react";
import { createMyListing, type Result } from "@/app/seller/actions";

export function ListingForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createMyListing(title, description, Number(price));
      setResult(r);
      if (r.ok) {
        setTitle("");
        setDescription("");
        setPrice("");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-foreground">New listing</h2>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col text-xs text-muted-foreground">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="I'll edit your podcast episode"
            className="mt-1 w-72 rounded-md border border-border px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          Price (USD)
          <input
            required
            type="number"
            min="1"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="99"
            className="mt-1 w-28 rounded-md border border-border px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>
      <label className="flex flex-col text-xs text-muted-foreground">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What the buyer gets, turnaround time, what you need from them…"
          className="mt-1 rounded-md border border-border px-2 py-1.5 text-sm text-foreground"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create draft"}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
