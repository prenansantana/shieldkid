export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { desc, eq, or, and, count, gte } from "drizzle-orm";
import { WebhookTable } from "./webhook-table";
import { JobsPanel } from "./jobs-panel";

async function getWebhookData(page: number = 1, perPage: number = 30) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const webhookFilter = or(
    eq(auditLog.eventType, "webhook.dispatched"),
    eq(auditLog.eventType, "webhook.failed")
  );

  const [total] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(webhookFilter);

  const [totalSent] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(eq(auditLog.eventType, "webhook.dispatched"));

  const [totalFailed] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(eq(auditLog.eventType, "webhook.failed"));

  const [recentSent] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(and(eq(auditLog.eventType, "webhook.dispatched"), gte(auditLog.timestamp, sevenDaysAgo)));

  const [recentFailed] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(and(eq(auditLog.eventType, "webhook.failed"), gte(auditLog.timestamp, sevenDaysAgo)));

  const items = await db
    .select({
      id: auditLog.id,
      eventType: auditLog.eventType,
      payload: auditLog.payload,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .where(webhookFilter)
    .orderBy(desc(auditLog.timestamp))
    .limit(perPage)
    .offset((page - 1) * perPage);

  // Serialize dates for client component
  const serializedItems = items.map((item) => ({
    ...item,
    timestamp: item.timestamp.toISOString(),
  }));

  return {
    items: serializedItems,
    total: total!.count,
    totalPages: Math.ceil(total!.count / perPage),
    stats: {
      totalSent: totalSent!.count,
      totalFailed: totalFailed!.count,
      recentSent: recentSent!.count,
      recentFailed: recentFailed!.count,
    },
  };
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const { items, total, totalPages, stats } = await getWebhookData(page);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
        <p className="text-sm text-gray-500">{total} eventos no total</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Enviados (total)" value={stats.totalSent} color="text-green-700 bg-green-50" />
        <StatCard label="Falhas (total)" value={stats.totalFailed} color="text-red-700 bg-red-50" />
        <StatCard label="Enviados (7 dias)" value={stats.recentSent} color="text-blue-700 bg-blue-50" />
        <StatCard label="Falhas (7 dias)" value={stats.recentFailed} color="text-orange-700 bg-orange-50" />
      </div>

      {/* Agendamentos pgboss */}
      <JobsPanel />

      <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Histórico de disparos</h2>
      <WebhookTable items={items} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/webhooks?page=${p}`}
              className={`px-3 py-1 rounded text-sm ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
