"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, type LoginResult } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<LoginResult | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await signIn(email, password, next);
      if (res.ok && res.redirectTo) {
        router.push(res.redirectTo);
      } else {
        setResult(res);
      }
    });
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
      <label className="flex flex-col text-xs text-muted-foreground">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-1 rounded-md border border-border px-3 py-2 text-sm text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {result && !result.ok && (
        <p className="text-xs text-red-700">{result.message}</p>
      )}
    </form>
  );
}
