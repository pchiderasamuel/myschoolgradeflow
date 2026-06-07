import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Paystack sends webhook events to this public endpoint.
// No Authorization header check — Paystack does NOT send one.
// Security is enforced by HMAC-SHA512 signature verification.

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecret) {
    console.error("PAYSTACK_SECRET_KEY not set");
    return Response.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // ── 1. Read raw body for signature verification ────────────────────
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 401 });
  }

  // ── 2. Verify HMAC-SHA512 signature ──────────────────────────────
  const encoder = new TextEncoder();
  const keyData = encoder.encode(paystackSecret);
  const messageData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedSignature !== signature) {
    console.warn("Webhook signature mismatch");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── 3. Parse event ────────────────────────────────────────────────
  let event: { event: string; data: { reference: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = event?.data?.reference;
  if (!reference) {
    return Response.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ── 4. Handle event types ─────────────────────────────────────────
  try {
    if (event.event === "charge.success") {
      const { error, data } = await serviceClient
        .from("payments")
        .update({ status: "success", paid_at: new Date().toISOString() })
        .eq("reference", reference)
        .select("id, status, student_id")
        .single();

      if (error) {
        console.error(`Failed to update payment success for ${reference}:`, error.message);
        throw new Error(`Payment update failed: ${error.message} (reference: ${reference})`);
      }
      console.log(`Payment success recorded: ${reference} (student_id: ${(data as any)?.student_id})`);

    } else if (
      event.event === "charge.failed" ||
      event.event === "transfer.failed" ||
      event.event === "transfer.reversed"
    ) {
      const { error, data } = await serviceClient
        .from("payments")
        .update({ status: "failed" })
        .eq("reference", reference)
        .select("id, status, student_id")
        .single();

      if (error) {
        console.error(`Failed to update payment failure for ${reference}:`, error.message);
        throw new Error(`Payment failure update failed: ${error.message} (reference: ${reference}, event: ${event.event})`);
      }
      console.log(`Payment failure recorded: ${reference} (${event.event}, student_id: ${(data as any)?.student_id})`);

    } else {
      // Unhandled event type — acknowledge receipt so Paystack doesn't retry
      console.warn(`Unhandled Paystack event: ${event.event} (reference: ${reference})`);
    }

    return Response.json({ success: true, reference }, { status: 200 });
  } catch (err) {
    const errorContext = err instanceof Error ? err.message : String(err);
    console.error(`payment-webhook error (reference: ${reference}):`, errorContext);
    return Response.json(
      { error: "Payment processing failed", reference, details: errorContext },
      { status: 500 }
    );
  }
});
