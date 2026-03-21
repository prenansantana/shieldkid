export const dynamic = "force-dynamic";

import { db } from "@/server/db";
import { ageVerification } from "@/server/db/schema";
import { desc, count } from "drizzle-orm";

async function getVerifications(page: number = 1, perPage: number = 20) {
  const [total] = await db.select({ count: count() }).from(ageVerification);

  const items = await db
    .select()
    .from(ageVerification)
    .orderBy(desc(ageVerification.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return {
    items,
    total: total!.count,
    totalPages: Math.ceil(total!.count / perPage),
  };
}

const bracketLabels: Record<string, string> = {
  child: "Criança (<12)",
  teen_12_15: "Adolescente (12-15)",
  teen_16_17: "Jovem (16-17)",
  adult: "Adulto (18+)",
};

const sourceLabels: Record<string, string> = {
  serpro: "Serpro",
  cache: "Cache",
  ai: "IA",
};

const sourceColors: Record<string, string> = {
  serpro: "bg-blue-100 text-blue-700",
  cache: "bg-gray-100 text-gray-700",
  ai: "bg-purple-100 text-purple-700",
};

const bracketColors: Record<string, string> = {
  child: "bg-red-100 text-red-700",
  teen_12_15: "bg-orange-100 text-orange-700",
  teen_16_17: "bg-yellow-100 text-yellow-700",
  adult: "bg-green-100 text-green-700",
};

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const { items, total, totalPages } = await getVerifications(page);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Verificações</h1>
        <p className="text-sm text-gray-500">{total} verificações no total</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                ID do Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Faixa Etária
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Idade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fonte
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Data
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Nenhuma verificação ainda.
                </td>
              </tr>
            ) : (
              items.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {v.externalUserId}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${bracketColors[v.ageBracket] ?? ""}`}
                    >
                      {bracketLabels[v.ageBracket] ?? v.ageBracket}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {v.ageAtVerification} anos
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      sourceColors[v.source] ?? "bg-gray-100 text-gray-700"
                    }`}>
                      {sourceLabels[v.source] ?? v.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {v.createdAt.toLocaleDateString("pt-BR")}{" "}
                    {v.createdAt.toLocaleTimeString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/verifications?page=${p}`}
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
