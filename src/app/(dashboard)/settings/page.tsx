"use client";

import { useState, useEffect, useCallback } from "react";

type TokenInfo = {
  id: string;
  name: string;
  tokenType: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function SettingsPage() {
  // Serpro
  const [serproApiUrl, setSerproApiUrl] = useState(
    "https://gateway.apiserpro.serpro.gov.br"
  );
  const [serproClientId, setSerproClientId] = useState("");
  const [serproClientSecret, setSerproClientSecret] = useState("");

  // Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);

  // Tokens
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenType, setNewTokenType] = useState<"publishable" | "secret">("publishable");
  const [newTokenValue, setNewTokenValue] = useState("");
  const [showNewToken, setShowNewToken] = useState(false);

  // UI
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSerproApiUrl(data.settings.serproApiUrl ?? "https://gateway.apiserpro.serpro.gov.br");
          setSerproClientId(data.settings.serproClientId ?? "");
          setWebhookUrl(data.settings.webhookUrl ?? "");
          setWebhookSecret(data.settings.webhookSecret ?? "");
          setWebhookEvents(data.settings.webhookEvents ?? []);
        }
        if (data.tokens) {
          setTokens(data.tokens);
        }
      }
    } catch {
      // Ignore — will use defaults
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serproApiUrl,
          serproClientId: serproClientId || undefined,
          serproClientSecret: serproClientSecret || undefined,
          webhookUrl: webhookUrl || undefined,
          webhookSecret: webhookSecret || undefined,
          webhookEvents,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setSaved(true);
      setSerproClientSecret("");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erro ao salvar configuracoes");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateToken() {
    if (!newTokenName.trim()) {
      setTokenError("Nome do token obrigatório");
      return;
    }
    setCreatingToken(true);
    setTokenError("");
    try {
      const res = await fetch("/api/dashboard/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTokenName, type: newTokenType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenError(data.error ?? "Erro ao criar token");
        return;
      }
      setNewTokenValue(data.token);
      setShowNewToken(true);
      setNewTokenName("");
      loadData();
    } catch {
      setTokenError("Erro ao criar token");
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleDeleteToken(tokenId: string) {
    try {
      await fetch(`/api/dashboard/tokens?id=${tokenId}`, { method: "DELETE" });
      loadData();
    } catch {
      // Ignore
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Configuracoes</h1>

      <div className="space-y-8">
        {/* Serpro */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Serpro (opcional)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Credenciais da API do Serpro para verificação por CPF.
            Sem o Serpro, o ShieldKid usa apenas IA (estimativa de idade por selfie).
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API URL
              </label>
              <input
                type="text"
                value={serproApiUrl}
                onChange={(e) => setSerproApiUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={serproClientId}
                onChange={(e) => setSerproClientId(e.target.value)}
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
                value={serproClientSecret}
                onChange={(e) => setSerproClientSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Deixe vazio para manter o atual"
              />
              <p className="text-xs text-gray-400 mt-1">
                Armazenado criptografado. Nunca exibido apos salvar.
              </p>
            </div>
          </div>
        </section>

        {/* Webhooks */}
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
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
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
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="whsec_xxx"
              />
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
                      checked={webhookEvents.includes(event)}
                      onChange={(e) => {
                        setWebhookEvents((prev) =>
                          e.target.checked
                            ? [...prev, event]
                            : prev.filter((ev) => ev !== event)
                        );
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

        {/* Save button */}
        <div className="flex items-center justify-end gap-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && (
            <span className="text-sm text-green-600">
              Configuracoes salvas!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar configuracoes"}
          </button>
        </div>

        {/* API Tokens */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Tokens de API
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Crie tokens para autenticar chamadas da API e do SDK.
          </p>

          {/* New token banner */}
          {showNewToken && newTokenValue && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Copie seu token agora. Ele não será exibido novamente.
              </p>
              <code className="block bg-yellow-100 px-3 py-2 rounded text-sm font-mono text-yellow-900 break-all select-all">
                {newTokenValue}
              </code>
              <button
                onClick={() => {
                  setShowNewToken(false);
                  setNewTokenValue("");
                }}
                className="mt-2 text-xs text-yellow-700 underline"
              >
                Entendi, fechar
              </button>
            </div>
          )}

          {/* Existing tokens */}
          {tokens.length > 0 && (
            <div className="mb-4 divide-y divide-gray-100">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {t.name}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          t.tokenType === "publishable"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {t.tokenType === "publishable" ? "pública" : "secreta"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Criado em{" "}
                      {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                      {t.lastUsedAt && (
                        <>
                          {" "}| Ultimo uso:{" "}
                          {new Date(t.lastUsedAt).toLocaleDateString("pt-BR")}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteToken(t.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create token */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Nome do token (ex: produção, staging)"
            />
            <select
              value={newTokenType}
              onChange={(e) => setNewTokenType(e.target.value as "publishable" | "secret")}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="publishable">Pública (SDK)</option>
              <option value="secret">Secreta (servidor)</option>
            </select>
            <button
              onClick={handleCreateToken}
              disabled={creatingToken}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingToken ? "Criando..." : "Criar token"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Chave pública: segura para usar no browser/SDK. Chave secreta: apenas no servidor.
          </p>
          {tokenError && (
            <p className="text-sm text-red-600 mt-2">{tokenError}</p>
          )}
        </section>
      </div>
    </div>
  );
}
