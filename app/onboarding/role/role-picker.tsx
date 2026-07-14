"use client";

import { useState, useTransition } from "react";
import { chooseRole, type RoleResult } from "./actions";

type PickableRole = "buyer" | "seller";

const OPTIONS: { role: PickableRole; title: string; blurb: string }[] = [
  {
    role: "buyer",
    title: "I'm a buyer",
    blurb: "I'm a business paying creators for work.",
  },
  {
    role: "seller",
    title: "I'm a seller",
    blurb: "I'm a creator/freelancer doing the work and getting paid.",
  },
];

export function RolePicker({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState<PickableRole | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RoleResult | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      setResult({ ok: false, message: "Pick buyer or seller." });
      return;
    }
    startTransition(async () => {
      // On success the action redirects; only failures come back.
      setResult(await chooseRole(role, name));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col text-xs text-muted-foreground">
        Your name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          className="mt-1 rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.role}
            type="button"
            onClick={() => setRole(opt.role)}
            className={`rounded-lg border p-4 text-left transition ${
              role === opt.role
                ? "border-foreground bg-white ring-1 ring-foreground"
                : "border-border bg-white hover:border-foreground/40"
            }`}
          >
            <span className="block text-sm font-medium text-foreground">
              {opt.title}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {opt.blurb}
            </span>
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Continue"}
      </button>
      {result && !result.ok && (
        <p className="text-xs text-red-700">{result.message}</p>
      )}
    </form>
  );
}
