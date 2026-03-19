export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import { ageVerifications, cpfCache, auditLogs } from "@/server/db/schema";
import { count, gte } from "drizzle-orm";

async function getStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalVerifications] = await db
    .select({ count: count() })
    .from(ageVerifications);

  const [recentVerifications] = await db
    .select({ count: count() })
    .from(ageVerifications)
    .where(gte(ageVerifications.createdAt, sevenDaysAgo));

  const [cachedCpfs] = await db.select({ count: count() }).from(cpfCache);

  const [auditCount] = await db.select({ count: count() }).from(auditLogs);

  const bracketCounts = await db
    .select({
      ageBracket: ageVerifications.ageBracket,
      count: count(),
    })
    .from(ageVerifications)
    .groupBy(ageVerifications.ageBracket);

  return {
    totalVerifications: totalVerifications!.count,
    recentVerifications: recentVerifications!.count,
    cachedCpfs: cachedCpfs!.count,
    auditLogs: auditCount!.count,
    brackets: Object.fromEntries(
      bracketCounts.map((b) => [b.ageBracket, b.count])
    ),
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
        <StatCard title="Logs de Auditoria" value={stats.auditLogs} />
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
