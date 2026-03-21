import { NextRequest, NextResponse } from "next/server";

/**
 * Mock webhook receiver for testing.
 * Logs received events to console and stores in memory.
 * GET returns the last 50 received events.
 */

type WebhookEntry = {
  receivedAt: string;
  event: string;
  signature: string | null;
  body: unknown;
};

const received: WebhookEntry[] = [];

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-shieldkid-signature");
  const event = req.headers.get("x-shieldkid-event");
  const body = await req.json();

  const entry: WebhookEntry = {
    receivedAt: new Date().toISOString(),
    event: event ?? "unknown",
    signature,
    body,
  };

  received.unshift(entry);
  if (received.length > 50) received.length = 50;

  console.log(`[Mock Webhook] Recebido: ${event}`, JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ events: received, total: received.length });
}
