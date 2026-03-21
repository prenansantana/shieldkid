"use client";

import { useState, useEffect, useCallback, Fragment } from "react";

type Schedule = {
  name: string;
  cron: string;
  timezone: string | null;
  created_on: string;
  updated_on: string;
};

type Job = {
  name: string;
  state: string;
  data: Record<string, unknown> | null;
  created_on: string;
  started_on: string | null;
  completed_on: string | null;
};

type JobsData = {
  schedules: Schedule[];
  recentJobs: Job[];
  pgbossActive: boolean;
};

const stateLabels: Record<string, { label: string; color: string }> = {
  created: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  active: { label: "Executando", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700" },
  expired: { label: "Expirado", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-600" },
};

const cronDescriptions: Record<string, string> = {
  "0 3 * * *": "Diariamente às 03:00 UTC",
  "*/5 * * * *": "A cada 5 minutos",
  "0 * * * *": "A cada hora",
  "0 0 * * *": "Diariamente à meia-noite UTC",
};

export function JobsPanel() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/jobs");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <p className="text-sm text-gray-400">Carregando agendamentos...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 mb-8">
      {/* pgboss status */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Agendamentos (pgboss)</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
            data.pgbossActive
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              data.pgbossActive ? "bg-green-500" : "bg-yellow-500"
            }`}
          />
          {data.pgbossActive ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* Schedules */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">Cron jobs agendados</h3>
        </div>

        {data.schedules.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            {data.pgbossActive
              ? "Nenhum cron agendado."
              : "pgboss não está ativo. Reinicie o servidor para inicializar os workers."}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Job
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cron
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.schedules.map((s) => (
                <tr key={s.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {s.cron}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {cronDescriptions[s.cron] ?? s.cron}
                    {s.timezone && ` (${s.timezone})`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(s.created_on).toLocaleDateString("pt-BR")}{" "}
                    {new Date(s.created_on).toLocaleTimeString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent jobs */}
      {data.recentJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">
              Execuções recentes ({data.recentJobs.length})
            </h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Job
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Criado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Concluído
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.recentJobs.map((j, idx) => {
                const info = stateLabels[j.state] ?? {
                  label: j.state,
                  color: "bg-gray-100 text-gray-600",
                };
                const isExpanded = expandedJob === idx;

                return (
                  <Fragment key={idx}>
                    <tr
                      onClick={() => setExpandedJob(isExpanded ? null : idx)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-3 text-sm font-mono text-gray-900">
                        {j.name}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${info.color}`}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(j.created_on).toLocaleDateString("pt-BR")}{" "}
                        {new Date(j.created_on).toLocaleTimeString("pt-BR")}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {j.completed_on
                          ? `${new Date(j.completed_on).toLocaleDateString("pt-BR")} ${new Date(j.completed_on).toLocaleTimeString("pt-BR")}`
                          : "—"}
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform inline-block ml-2 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </td>
                    </tr>

                    {isExpanded && j.data && (
                      <tr>
                        <td colSpan={4} className="px-6 pb-4 pt-0 bg-gray-50">
                          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                              {JSON.stringify(j.data, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
