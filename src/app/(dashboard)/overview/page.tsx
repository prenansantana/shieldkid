export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import { ageVerification, cpfCache, auditLog } from "@/server/db/schema";
import { count, gte, eq, desc, or } from "drizzle-orm";

async function getStats() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalVerifications] = await db
    .select({ count: count() })
    .from(ageVerification);

  const [recentVerifications] = await db
    .select({ count: count() })
    .from(ageVerification)
    .where(gte(ageVerification.createdAt, sevenDaysAgo));

  const [cachedCpfs] = await db.select({ count: count() }).from(cpfCache);

  const [auditCount] = await db.select({ count: count() }).from(auditLog);

  const bracketCounts = await db
    .select({
      ageBracket: ageVerification.ageBracket,
      count: count(),
    })
    .from(ageVerification)
    .groupBy(ageVerification.ageBracket);

  // Webhook stats from audit log
  const [webhooksSent] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(eq(auditLog.eventType, "webhook.dispatched"));

  const [webhooksFailed] = await db
    .select({ count: count() })
    .from(auditLog)
    .where(eq(auditLog.eventType, "webhook.failed"));

  // Recent webhook events (last 10)
  const recentWebhooks = await db
    .select({
      id: auditLog.id,
      eventType: auditLog.eventType,
      payload: auditLog.payload,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .where(
      or(
        eq(auditLog.eventType, "webhook.dispatched"),
        eq(auditLog.eventType, "webhook.failed")
      )
    )
    .orderBy(desc(auditLog.timestamp))
    .limit(10);

  return {
    totalVerifications: totalVerifications!.count,
    recentVerifications: recentVerifications!.count,
    cachedCpfs: cachedCpfs!.count,
    auditLog: auditCount!.count,
    brackets: Object.fromEntries(
      bracketCounts.map((b) => [b.ageBracket, b.count])
    ),
    webhooksSent: webhooksSent!.count,
    webhooksFailed: webhooksFailed!.count,
    recentWebhooks,
  };
}

export default async function OverviewPage() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total de Verificações"
          value={stats.totalVerifications}
        />
        <StatCard
          title="Últimos 7 dias"
          value={stats.recentVerifications}
        />
        <StatCard title="CPFs em Cache" value={stats.cachedCpfs} />
        <StatCard title="Logs de Auditoria" value={stats.auditLog} />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Distribuição por Faixa Etária
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BracketCard
            label="Criança (<12)"
            count={stats.brackets.child ?? 0}
            color="bg-red-100 text-red-800"
          />
          <BracketCard
            label="Adolescente (12-15)"
            count={stats.brackets.teen_12_15 ?? 0}
            color="bg-orange-100 text-orange-800"
          />
          <BracketCard
            label="Jovem (16-17)"
            count={stats.brackets.teen_16_17 ?? 0}
            color="bg-yellow-100 text-yellow-800"
          />
          <BracketCard
            label="Adulto (18+)"
            count={stats.brackets.adult ?? 0}
            color="bg-green-100 text-green-800"
          />
        </div>
      </div>

      {/* Webhooks */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Webhooks
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg p-4 bg-green-50">
            <p className="text-sm text-green-700">Enviados</p>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {stats.webhooksSent.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-lg p-4 bg-red-50">
            <p className="text-sm text-red-700">Falhas</p>
            <p className="text-2xl font-bold text-red-900 mt-1">
              {stats.webhooksFailed.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {stats.recentWebhooks.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Eventos recentes</h3>
            <div className="divide-y divide-gray-100">
              {stats.recentWebhooks.map((w) => {
                const payload = w.payload as Record<string, unknown> | null;
                const isSuccess = w.eventType === "webhook.dispatched";
                return (
                  <div key={w.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          isSuccess ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm font-mono text-gray-700">
                        {(payload?.event as string) ?? w.eventType}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {w.timestamp.toLocaleDateString("pt-BR")}{" "}
                      {w.timestamp.toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Nenhum webhook disparado ainda. Configure em Configurações.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function BracketCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{count.toLocaleString("pt-BR")}</p>
    </div>
  );
}
