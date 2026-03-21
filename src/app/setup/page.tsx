"use client";

import { useState, useEffect } from "react";
import { signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type Step = "admin" | "serpro" | "token" | "done";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("admin");
  const [error, setError] = useState("");

  // Admin form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Serpro form
  const [serproClientId, setSerproClientId] = useState("");
  const [serproClientSecret, setSerproClientSecret] = useState("");

  // Token
  const [tokenName, setTokenName] = useState("default");
  const [generatedToken, setGeneratedToken] = useState("");

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.needsSetup) {
          router.replace("/login");
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? "Erro ao criar conta");
        setLoading(false);
        return;
      }
      setStep("serpro");
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSerpro(e: React.FormEvent) {
    e.preventDefault();
    setStep("token");
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serproClientId: serproClientId || undefined,
          serproClientSecret: serproClientSecret || undefined,
          tokenName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao finalizar setup");
        setLoading(false);
        return;
      }

      setGeneratedToken(data.apiToken ?? "");
      setStep("done");
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (loading && step === "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ShieldKid</h1>
          <p className="text-sm text-gray-500 mt-2">
            Configuracao inicial
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["admin", "serpro", "token", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-gray-900 text-white"
                    : (["admin", "serpro", "token", "done"] as Step[]).indexOf(step) > i
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {(["admin", "serpro", "token", "done"] as Step[]).indexOf(step) > i
                  ? "\u2713"
                  : i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`w-8 h-0.5 ${
                    (["admin", "serpro", "token", "done"] as Step[]).indexOf(step) > i
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Create Admin */}
        {step === "admin" && (
          <form
            onSubmit={handleCreateAdmin}
            className="bg-white rounded-lg shadow p-6 space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Criar conta de administrador
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Este será o único usuário com acesso ao dashboard.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar admin e continuar"}
            </button>
          </form>
        )}

        {/* Step 2: Serpro Config */}
        {step === "serpro" && (
          <form
            onSubmit={handleSerpro}
            className="bg-white rounded-lg shadow p-6 space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Configurar Serpro (opcional)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Credenciais da API do Serpro para verificação de CPF.
                Sem o Serpro, a verificação usará apenas o modelo de IA
                (estimativa de idade por selfie). Você pode configurar depois
                em Configurações.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={serproClientId}
                onChange={(e) => setSerproClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Seu Client Secret do Serpro"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("token")}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Pular — usar apenas IA
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
              >
                Continuar
              </button>
            </div>
          </form>
        )}

        {/* Step 3: API Token */}
        {step === "token" && (
          <form
            onSubmit={handleCreateToken}
            className="bg-white rounded-lg shadow p-6 space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Criar token de API
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Este token será usado pelo SDK e pela API REST para autenticar
                as chamadas de verificação.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do token
              </label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: produção, staging"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Finalizando..." : "Criar token e finalizar"}
            </button>
          </form>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Tudo pronto!
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Sua instância do ShieldKid está configurada.
              </p>
            </div>

            {generatedToken && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  Copie seu token de API agora. Ele não será exibido novamente.
                </p>
                <code className="block bg-yellow-100 px-3 py-2 rounded text-sm font-mono text-yellow-900 break-all select-all">
                  {generatedToken}
                </code>
              </div>
            )}

            <div className="bg-gray-50 rounded-md p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Próximo passo:</p>
              <p className="text-sm text-gray-500">
                Use o token acima para chamar a API de verificação:
              </p>
              <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded overflow-x-auto">
{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/v1/verify \\
  -H "Authorization: Bearer ${generatedToken || "SEU_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{"cpf":"12345678901","externalUserId":"user_1"}'`}
              </pre>
            </div>

            <button
              onClick={() => router.push("/overview")}
              className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800"
            >
              Ir para o dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
