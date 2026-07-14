"use client";

import { useState, useTransition } from "react";
import {
  onboardSeller,
  getSellerLink,
  syncPayoutStatus,
  type Result,
} from "@/app/dashboard/platform-actions";

export function SellerActions({
  sellerId,
  hasAccount,
  defaultEmail,
}: {
  sellerId: string;
  hasAccount: boolean;
  defaultEmail: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  function run(fn: () => Promise<Result>) {
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok && r.url) window.open(r.url, "_blank", "noopener");
    });
  }

  function onboard() {
    // Whop needs a real, deliverable owner email for the connected account.
    const email = window.prompt(
      "Owner email for the Whop connected account (must accept mail):",
      defaultEmail,
    );
    if (email === null) return; // cancelled
    run(() => onboardSeller(sellerId, email));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {!hasAccount ? (
          <Btn disabled={pending} onClick={onboard}>
            Onboard on Whop
          </Btn>
        ) : (
          <>
            <Btn
              disabled={pending}
              onClick={() => run(() => getSellerLink(sellerId, "account_onboarding"))}
            >
              KYC link
            </Btn>
            <Btn
              disabled={pending}
              onClick={() => run(() => getSellerLink(sellerId, "payouts_portal"))}
            >
              Payout portal
            </Btn>
            <Btn disabled={pending} onClick={() => run(() => syncPayoutStatus(sellerId))}>
              Sync status
            </Btn>
          </>
        )}
      </div>
      {result && (
        <span className={`text-[11px] ${result.ok ? "text-green-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      {children}
    </button>
  );
}
