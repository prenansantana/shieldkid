import { z } from "zod/v4";

const SerproCpfResponse = z.object({
  ni: z.string(),
  nome: z.string(),
  nascimento: z.string(), // DD/MM/YYYY
  situacao: z.object({
    codigo: z.string(),
    descricao: z.string(),
  }),
});

type SerproCpfResult = {
  birthDate: Date;
  cpfStatus: "regular" | "irregular" | "cancelled" | "null";
  name: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSerproToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.SERPRO_CLIENT_ID;
  const clientSecret = process.env.SERPRO_CLIENT_SECRET;
  const apiUrl = process.env.SERPRO_API_URL;

  if (!clientId || !clientSecret || !apiUrl) {
    throw new Error("Serpro credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const response = await fetch(`${apiUrl}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Serpro auth failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    // Expire 60s early to avoid edge cases
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

/**
 * Query Serpro CPF API for birth date information.
 * Cost: ~R$0.40 per query.
 */
export async function queryCpf(cpf: string): Promise<SerproCpfResult> {
  const normalized = cpf.replace(/\D/g, "");

  // Mock mode for development
  if (process.env.SERPRO_MOCK === "true") {
    return getMockResponse(normalized);
  }

  const apiUrl = process.env.SERPRO_API_URL;
  const token = await getSerproToken();

  const response = await fetch(`${apiUrl}/consulta-cpf-df/v1/cpf/${normalized}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Serpro CPF query failed: ${response.status}`);
  }

  const data = SerproCpfResponse.parse(await response.json());

  // Parse DD/MM/YYYY to Date
  const [day, month, year] = data.nascimento.split("/").map(Number);
  const birthDate = new Date(year!, month! - 1, day);

  const statusMap: Record<string, SerproCpfResult["cpfStatus"]> = {
    "0": "regular",
    "1": "null",
    "2": "irregular",
    "3": "cancelled",
  };

  return {
    birthDate,
    cpfStatus: statusMap[data.situacao.codigo] ?? "irregular",
    name: data.nome,
  };
}

function getMockResponse(cpf: string): SerproCpfResult {
  // Deterministic mock: last 2 digits of CPF determine birth year
  const lastTwo = parseInt(cpf.slice(-2), 10);
  const currentYear = new Date().getFullYear();
  // Map 00-99 to ages 5-30
  const age = 5 + Math.floor((lastTwo / 100) * 25);
  const birthYear = currentYear - age;

  return {
    birthDate: new Date(birthYear, 5, 15), // June 15
    cpfStatus: "regular",
    name: "Usuário de Teste",
  };
}
