"use client";

import { useState, useTransition } from "react";
import {
  setupConnectedAccount,
  getMyAccountLink,
  refreshMyPayoutStatus,
  type Result,
} from "@/app/seller/actions";

interface Props {
  hasAccount: boolean;
  payoutStatus: string;
}

/**
 * Three-step payout onboarding: connected account -> hosted KYC -> verified.
 * Rendered until payout_status is "ready", then the portal drops it.
 */
export function OnboardingCard({ hasAccount, payoutStatus }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function run(fn: () => Promise<Result>, opensUrl = false) {
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (opensUrl && r.ok && r.url) {
        window.open(r.url, "_blank", "noopener,noreferrer");
      }
    });
  }

  const steps = [
    {
      label: "Create your payout account",
      done: hasAccount,
      cta: "Create account",
      onClick: () => run(setupConnectedAccount),
    },
    {
      label: "Verify your identity (KYC on Whop)",
      done: payoutStatus === "ready",
      cta: "Open verification",
      onClick: () => run(() => getMyAccountLink("account_onboarding"), true),
      disabled: !hasAccount,
    },
    {
      label: "Confirm you're ready to get paid",
      done: payoutStatus === "ready",
      cta: "Check status",
      onClick: () => run(refreshMyPayoutStatus),
      disabled: !hasAccount,
    },
  ];

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900">
        Finish payout setup to start selling
      </h2>
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step.label} className="flex flex-wrap items-center gap-3">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                step.done
                  ? "bg-green-600 text-white"
                  : "border border-amber-300 bg-white text-amber-900"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm ${step.done ? "text-amber-900/60 line-through" : "text-amber-900"}`}
            >
              {step.label}
            </span>
            {!step.done && (
              <button
                onClick={step.onClick}
                disabled={pending || step.disabled}
                className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:border-amber-500 disabled:opacity-40"
              >
                {step.cta}
              </button>
            )}
          </li>
        ))}
      </ol>
      {result && (
        <p
          className={`mt-3 text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
