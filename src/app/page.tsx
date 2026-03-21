import Link from "next/link";

const dashboardLinks = [
  {
    href: "/overview",
    title: "Visão Geral",
    description: "Métricas, distribuição por faixa etária e status dos webhooks",
    icon: "📊",
  },
  {
    href: "/verifications",
    title: "Verificações",
    description: "Histórico completo de verificações de idade realizadas",
    icon: "✅",
  },
  {
    href: "/webhooks",
    title: "Webhooks",
    description: "Histórico de eventos disparados e falhas",
    icon: "🔔",
  },
  {
    href: "/settings",
    title: "Configurações",
    description: "Serpro, webhooks e tokens de API",
    icon: "⚙️",
  },
];

const devLinks = [
  {
    href: "/mock/sdk",
    title: "Demo do SDK",
    description: "Teste o widget com câmera (rosto, CPF ou ambos)",
    icon: "🧪",
  },
  {
    href: "/mock/face",
    title: "Demo Câmera",
    description: "Teste direto da estimativa de idade por selfie via IA",
    icon: "📷",
  },
  {
    href: "/setup",
    title: "Configuração Inicial",
    description: "Criação do admin e credenciais de acesso",
    icon: "🚀",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-14 max-w-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 text-white text-3xl mb-6 shadow-lg">
          🛡️
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
          ShieldKid
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed">
          Verificação de idade e controle parental open-source em conformidade
          com a <span className="font-semibold text-gray-700">Lei Felca</span>{" "}
          (Lei 15.211/2025 — ECA Digital).
        </p>
      </div>

      {/* Dashboard */}
      <section className="w-full max-w-4xl mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4 px-1">
          Dashboard
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {dashboardLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col gap-2 p-5 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all group"
            >
              <span className="text-2xl">{link.icon}</span>
              <span className="font-semibold text-gray-900 group-hover:text-black text-sm">
                {link.title}
              </span>
              <span className="text-xs text-gray-400 leading-relaxed">
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Dev / Setup */}
      <section className="w-full max-w-4xl">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4 px-1">
          Desenvolvimento & Setup
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {devLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col gap-2 p-5 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all group"
            >
              <span className="text-2xl">{link.icon}</span>
              <span className="font-semibold text-gray-900 group-hover:text-black text-sm">
                {link.title}
              </span>
              <span className="text-xs text-gray-400 leading-relaxed">
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-12 text-xs text-gray-300">
        v0.1.0 — Lei 15.211/2025 (ECA Digital)
      </p>
    </main>
  );
}
