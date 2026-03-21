import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";

export type AuditEventType =
  | "verification.cpf.started"
  | "verification.cpf.completed"
  | "verification.cpf.cache_hit"
  | "verification.cpf.failed"
  | "verification.ai.started"
  | "verification.ai.completed"
  | "verification.ai.failed"
  | "parental.link.created"
  | "parental.link.approved"
  | "parental.link.revoked"
  | "age_bracket.transition"
  | "webhook.dispatched"
  | "webhook.failed"
  | "settings.updated"
  | "token.created"
  | "token.revoked";

export async function logAudit(params: {
  eventType: AuditEventType;
  actorId?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await db.insert(auditLog).values({
    eventType: params.eventType,
    actorId: params.actorId,
    targetId: params.targetId,
    payload: params.payload,
    ipAddress: params.ipAddress,
  });
}
