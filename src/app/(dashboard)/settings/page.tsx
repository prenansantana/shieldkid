"use client";

import { useState, useEffect } from "react";

type Settings = {
  serproApiUrl: string;
  serproClientId: string;
  webhookUrl: string;
  webhookSecret: string;
  webhookEvents: string[];
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    serproApiUrl: "https://gateway.apiserpro.serpro.gov.br",
    serproClientId: "",
    webhookUrl: "",
    webhookSecret: "",
    webhookEvents: [],
  });
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Configurações</h1>

      <div className="space-y-8">
        {/* Serpro Configuration */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Serpro (CPF API)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Configure suas credenciais do Serpro. Cada plataforma precisa
            contratar seu próprio acesso.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API URL
              </label>
              <input
                type="text"
                value={settings.serproApiUrl}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, serproApiUrl: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={settings.serproClientId}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    serproClientId: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Seu Client ID do Serpro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-400 mt-1">
                Armazenado criptografado. Nunca exibido após salvar.
              </p>
            </div>
          </div>
        </section>

        {/* Webhook Configuration */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Webhooks
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Receba eventos quando verificações são concluídas ou faixas etárias
            mudam.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL do Webhook
              </label>
              <input
                type="url"
                value={settings.webhookUrl}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, webhookUrl: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="https://seuapp.com/webhooks/shieldkid"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret do Webhook
              </label>
              <input
                type="text"
                value={settings.webhookSecret}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    webhookSecret: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="whsec_xxx"
              />
              <p className="text-xs text-gray-400 mt-1">
                Usado para assinar os payloads via HMAC-SHA256.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eventos
              </label>
              <div className="space-y-2">
                {[
                  "verification.completed",
                  "age_bracket_change",
                  "parental.link.created",
                  "parental.link.approved",
                ].map((event) => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.webhookEvents.includes(event)}
                      onChange={(e) => {
                        setSettings((s) => ({
                          ...s,
                          webhookEvents: e.target.checked
                            ? [...s.webhookEvents, event]
                            : s.webhookEvents.filter((ev) => ev !== event),
                        }));
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-mono text-gray-600">
                      {event}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* API Tokens */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Tokens de API
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Crie tokens para autenticar chamadas da API e do SDK.
          </p>

          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            Criar novo token
          </button>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          {saved && (
            <span className="text-sm text-green-600 mr-4 self-center">
              Configurações salvas!
            </span>
          )}
          <button
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            }}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
          >
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  );
}
