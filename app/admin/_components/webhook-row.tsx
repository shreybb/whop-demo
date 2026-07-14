"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, shortId } from "@/lib/format";
import { replayEvent, type ActionResult } from "@/app/admin/actions";
import type { WebhookEventRow } from "@/lib/queries";

export function WebhookRow({ event }: { event: WebhookEventRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const needsReplay = event.signature_valid && !event.processed;

  function onReplay() {
    startTransition(async () => {
      setResult(await replayEvent(event.id));
    });
  }

  return (
    <>
      <tr className="border-t border-border hover:bg-muted/50">
        <td className="px-3 py-2 align-top">
          <button
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-xs text-blue-700 hover:underline"
            title={event.id}
          >
            {open ? "▾ " : "▸ "}
            {shortId(event.id, 14)}
          </button>
        </td>
        <td className="px-3 py-2 align-top font-mono text-xs">{event.type}</td>
        <td className="px-3 py-2 align-top">
          {event.signature_valid ? (
            <Badge tone="green">valid</Badge>
          ) : (
            <Badge tone="red">invalid</Badge>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {!event.signature_valid ? (
            <Badge tone="gray">—</Badge>
          ) : event.processed ? (
            <Badge tone="green">processed</Badge>
          ) : (
            <Badge tone="amber">unprocessed</Badge>
          )}
        </td>
        <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
          {event.order_id ? (
            <span title={event.order_id}>{shortId(event.order_id)}</span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
          {formatDateTime(event.received_at)}
        </td>
        <td className="px-3 py-2 align-top text-right">
          {needsReplay && (
            <button
              onClick={onReplay}
              disabled={pending}
              className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {pending ? "Replaying…" : "Replay"}
            </button>
          )}
        </td>
      </tr>
      {(open || result || event.error) && (
        <tr className="border-t border-border bg-muted/30">
          <td colSpan={7} className="px-3 py-2">
            {event.error && (
              <p className="mb-2 text-xs text-red-700">
                <span className="font-semibold">Last error:</span> {event.error}
              </p>
            )}
            {result && (
              <p
                className={`mb-2 text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}
              >
                {result.message}
              </p>
            )}
            {open && (
              <pre className="max-h-72 overflow-auto rounded-md bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
