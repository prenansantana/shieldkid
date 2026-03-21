import Link from "next/link";

const links = [
  {
    href: "/overview",
    title: "Overview",
    description: "Métricas, distribuição por faixa etária e status dos webhooks",
  },
  {
    href: "/verifications",
    title: "Verificações",
    description: "Histórico completo de verificações de idade realizadas",
  },
  {
    href: "/webhooks",
    title: "Webhooks",
    description: "Histórico completo de eventos disparados e falhas",
  },
  {
    href: "/settings",
    title: "Configurações",
    description: "Serpro, webhooks e tokens de API",
  },
  {
    href: "/mock/sdk",
    title: "Demo SDK",
    description: "Teste o widget de verificação com câmera (face, cpf, cpf+face)",
  },
  {
    href: "/mock/face",
    title: "Demo Câmera",
    description: "Teste direto da estimativa de idade por selfie (IA)",
  },
  {
    href: "/setup",
    title: "Setup",
    description: "Configuração inicial do admin e credenciais",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-2">ShieldKid</h1>
      <p className="text-lg text-gray-600 max-w-xl text-center mb-10">
        Open-source age verification &amp; parental control for compliance with
        Brazil&apos;s Lei Felca (ECA Digital).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {link.title}
            </h2>
            <p className="text-sm text-gray-500">{link.description}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-gray-400">
        v0.1.0 — Lei 15.211/2025 (ECA Digital)
      </p>
    </main>
  );
}
