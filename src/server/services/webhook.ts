import { createHmac } from "crypto";
import { db } from "@/server/db";
import { setting } from "@/server/db/schema";
import { decrypt } from "@/server/lib/crypto";
import { logAudit } from "./audit";

type WebhookEvent = {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
};

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatch a webhook event to the configured URL.
 * Returns true if successful, false otherwise.
 */
export async function dispatchWebhook(event: WebhookEvent): Promise<boolean> {
  const [config] = await db.select().from(setting).limit(1);
  const webhookSecret = config?.webhookSecret ? decrypt(config.webhookSecret) : null;
  if (!config?.webhookUrl || !webhookSecret) {
    return false;
  }

  // Check if this event type is enabled
  const enabledEvents = config.webhookEvents ?? [];
  if (enabledEvents.length > 0 && !enabledEvents.includes(event.event)) {
    return false;
  }

  const payload = JSON.stringify(event);
  const signature = signPayload(payload, webhookSecret);

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ShieldKid-Signature": signature,
        "X-ShieldKid-Event": event.event,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      await logAudit({
        eventType: "webhook.failed",
        payload: {
          event: event.event,
          status: response.status,
          url: config.webhookUrl,
        },
      });
      return false;
    }

    await logAudit({
      eventType: "webhook.dispatched",
      payload: { event: event.event, url: config.webhookUrl },
    });
    return true;
  } catch (error) {
    await logAudit({
      eventType: "webhook.failed",
      payload: {
        event: event.event,
        error: error instanceof Error ? error.message : "Unknown error",
        url: config.webhookUrl,
      },
    });
    return false;
  }
}
