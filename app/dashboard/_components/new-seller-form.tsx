"use client";

import { useState, useTransition } from "react";
import { createSeller, type Result } from "@/app/dashboard/platform-actions";

export function NewSellerForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createSeller(name, email);
      setResult(r);
      if (r.ok) {
        setName("");
        setEmail("");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-white p-3"
    >
      <label className="flex flex-col text-xs text-muted-foreground">
        Seller name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          className="mt-1 w-44 rounded-md border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Email (must accept mail)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@realmail.com"
          className="mt-1 w-56 rounded-md border border-border px-2 py-1 text-sm text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add seller"}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </form>
  );
}
