"use client";

import { useState, useEffect } from "react";

export default function SdkTestPage() {
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("demo-user-1");
  const [method, setMethod] = useState<"face" | "cpf" | "cpf+face">("face");
  const [result, setResult] = useState<string>("Aguardando verificação...");
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [origin, setOrigin] = useState("https://sua-instancia.com");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function openWidget() {
    // Dynamic import to avoid SSR issues
    const { ShieldKid } = await import("@/sdk/widget");

    const sk = ShieldKid.init({
      endpoint: window.location.origin,
      token,
      method,
      mode: "gate",
      locale: "pt-BR",
      onVerified: (res) => {
        setResult(JSON.stringify(res, null, 2));
        setWidgetOpen(false);
      },
      onMinor: (res) => {
        console.log("Menor detectado:", res);
      },
      onError: (err) => {
        setResult("Erro: " + err.message);
        setWidgetOpen(false);
      },
    });

    setWidgetOpen(true);
    sk.open(userId);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            ShieldKid — Teste do SDK
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Simule como a plataforma integradora usa o widget
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cole aqui o token do setup"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              External User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user_123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Método de verificação
            </label>
            <div className="flex gap-2">
              {(["face", "cpf", "cpf+face"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border ${
                    method === m
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {m === "face"
                    ? "Selfie"
                    : m === "cpf"
                      ? "CPF"
                      : "CPF + Selfie"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={openWidget}
            disabled={!token || widgetOpen}
            className="w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {widgetOpen ? "Widget aberto..." : "Abrir Widget de Verificação"}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Resultado da verificação:
          </h3>
          <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {result}
          </pre>
        </div>

        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Codigo de integracao:
          </h3>
          <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">{`import { ShieldKid } from 'shieldkid-sdk';

const sk = ShieldKid.init({
  endpoint: '${origin}',
  token: '${token || "sk_xxx"}',
  method: '${method}',
  mode: 'gate',
  onVerified: (result) => {
    console.log(result.ageBracket);
    // "child" | "teen_12_15" | "teen_16_17" | "adult"
  },
  onMinor: (result) => {
    // Redirecionar para fluxo de responsável
  },
});

sk.open('${userId}');`}</pre>
        </div>
      </div>
    </div>
  );
}
