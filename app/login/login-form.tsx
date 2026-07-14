"use client";

import { useState, useTransition } from "react";
import { sendMagicLink, type LoginResult } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<LoginResult | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setResult(await sendMagicLink(email, next));
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-border bg-white p-4">
        <p className="text-sm font-medium text-foreground">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
        <button
          onClick={() => setResult(null)}
          className="mt-3 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4"
    >
      <label className="flex flex-col text-xs text-muted-foreground">
        Email
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="mt-1 rounded-md border border-border px-3 py-2 text-sm text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
      {result && !result.ok && (
        <p className="text-xs text-red-700">{result.message}</p>
      )}
    </form>
  );
}
