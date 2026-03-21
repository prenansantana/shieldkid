"use client";

import { useState, Fragment } from "react";

type WebhookItem = {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  timestamp: string;
};

export function WebhookTable({ items }: { items: WebhookItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center text-sm text-gray-400">
        Nenhum webhook disparado ainda. Configure URL e secret em Configurações.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-4 py-3" />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Evento
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              URL
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Detalhes
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Data
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((w) => {
            const payload = w.payload;
            const isSuccess = w.eventType === "webhook.dispatched";
            const eventName = (payload?.event as string) ?? "—";
            const url = (payload?.url as string) ?? "—";
            const httpStatus = (payload?.status as number) ?? null;
            const error = (payload?.error as string) ?? null;
            const isExpanded = expandedId === w.id;
            const ts = new Date(w.timestamp);

            return (
              <Fragment key={w.id}>
                <tr
                  onClick={() => toggle(w.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-center">
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform inline-block ${
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
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        isSuccess
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isSuccess ? "Enviado" : "Falha"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {eventName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                    {url}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isSuccess ? (
                      <span className="text-green-600">OK</span>
                    ) : httpStatus ? (
                      <span className="text-red-600">HTTP {httpStatus}</span>
                    ) : error ? (
                      <span className="text-red-600 truncate max-w-[150px] block">
                        {error}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {ts.toLocaleDateString("pt-BR")}{" "}
                    {ts.toLocaleTimeString("pt-BR")}
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="px-4 pb-4 pt-0 bg-gray-50">
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                          {JSON.stringify(payload, null, 2)}
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
  );
}
