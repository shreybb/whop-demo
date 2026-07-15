import { validateWebhookRequest } from "@/lib/whop";
import { getSupabase } from "@/lib/supabase";
import { processEvent } from "@/lib/process-event";
import { eventAction } from "@/lib/state-machine";
import type Whop from "@whop/sdk";

/**
 * Whop webhook ingestion endpoint.
 *
 * Flow (order matters):
 *  1. Read raw body. Verify the signature. On failure -> log with
 *     signature_valid=false and return 401.
 *  2. Insert into webhook_events keyed by the Whop `webhook-id` (idempotency).
 *     If the row already existed, this is a duplicate delivery -> return 200.
 *  3. Route by action. Payment/refund events resolve to an order and advance it.
 *  4. Guarded, forward-only state machine: out-of-order events no-op, never regress.
 *  5. On processing error, record it on the event row but still return 200 so
 *     Whop doesn't retry-storm; the dashboard surfaces unprocessed events.
 */

// Webhooks must run on the Node.js runtime (crypto verification) and never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // --- Step 1: read raw body + verify signature -------------------------------
  const rawBody = await req.text();
  // The webhook-id header is attacker-controllable until the signature checks out,
  // so treat it as merely "claimed" for now.
  const claimedEventId = req.headers.get("webhook-id");

  let event: Whop.UnwrapWebhookEvent;
  try {
    event = validateWebhookRequest(rawBody, Object.fromEntries(req.headers));
  } catch (err) {
    // Do NOT key this row by the claimed webhook-id. A forged request could
    // pre-insert a real event's id and cause the genuine, signed delivery to be
    // skipped later as a "duplicate". Use a collision-free id and keep the
    // claimed id only as reference data in the payload.
    await logInvalidSignature(claimedEventId, rawBody, err);
    return json({ error: "invalid signature" }, 401);
  }

  // Signature verified — only now can we trust webhook-id as the idempotency key.
  const eventId = claimedEventId ?? `evt_${crypto.randomUUID()}`;

  // --- Step 2: idempotent insert ---------------------------------------------
  const supabase = getSupabase();
  const { error: insertError } = await supabase.from("webhook_events").insert({
    id: eventId,
    // Normalized: v1 REST events name this `type`, app webhooks `action`.
    type: eventAction(event),
    payload: event as unknown as Record<string, unknown>,
    signature_valid: true,
    processed: false,
  });

  if (insertError) {
    // 23505 = unique_violation on the PK -> we've already seen this event.
    if (insertError.code === "23505") {
      return json({ status: "duplicate", id: eventId }, 200);
    }
    // Unexpected DB error while logging: ack anyway (Whop retries are noisy),
    // but report so we notice. We can't mark a row we failed to write.
    console.error("[whop-webhook] failed to persist event", eventId, insertError);
    return json({ status: "log_failed", id: eventId }, 200);
  }

  // --- Steps 3-5: process, then mark the event row ---------------------------
  try {
    const result = await processEvent(event);
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        error: null,
        // Link the event to the order it touched, so the dashboard can reconcile
        // an order against its full event history.
        order_id: result.handled ? result.orderId : null,
      })
      .eq("id", eventId);
    return json({ status: "processed", id: eventId, ...result }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whop-webhook] processing error", eventId, message);
    await supabase
      .from("webhook_events")
      .update({ processed: false, error: message })
      .eq("id", eventId);
    // Return 200: retrying won't help a logic/data error, and the dashboard
    // flags unprocessed events for manual replay.
    return json({ status: "error", id: eventId }, 200);
  }
}

/**
 * Persist an invalid-signature attempt for the audit log. Best-effort.
 * Keyed by a fresh id (never the claimed webhook-id) so forged requests can't
 * squat on a real event's idempotency key. The claimed id is kept for reference.
 */
async function logInvalidSignature(
  claimedId: string | null,
  rawBody: string,
  err: unknown,
) {
  try {
    await getSupabase()
      .from("webhook_events")
      .insert({
        id: `invalid_${crypto.randomUUID()}`,
        type: "signature.invalid",
        payload: { claimed_webhook_id: claimedId, body: safeParse(rawBody) },
        signature_valid: false,
        processed: false,
        error: err instanceof Error ? err.message : String(err),
      });
  } catch (logErr) {
    console.error("[whop-webhook] failed to log invalid signature", logErr);
  }
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { raw };
  } catch {
    return { raw };
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
