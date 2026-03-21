import { z } from "zod/v4";

const SerproCpfResponse = z.object({
  ni: z.string(),
  nome: z.string(),
  nascimento: z.string(), // DDMMYYYY (trial) or DD/MM/YYYY (prod)
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

/**
 * Trial (sandbox) credentials from Serpro's public documentation.
 * These only work with the trial endpoint and return mock data.
 */
const TRIAL_CONFIG = {
  clientId: "djaR21PGoYp1iyK2n2ACOH9REdUb",
  clientSecret: "ObRsAJWOL4fv2Tp27D1vd8fB3Ote",
  apiPath: "consulta-cpf-df-trial",
};

function isTrialMode(): boolean {
  return process.env.SERPRO_MODE === "trial" || (
    !process.env.SERPRO_CLIENT_ID && !process.env.SERPRO_CLIENT_SECRET
  );
}

async function getSerproToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const trial = isTrialMode();
  const clientId = trial ? TRIAL_CONFIG.clientId : process.env.SERPRO_CLIENT_ID;
  const clientSecret = trial ? TRIAL_CONFIG.clientSecret : process.env.SERPRO_CLIENT_SECRET;
  const apiUrl = process.env.SERPRO_API_URL ?? "https://gateway.apiserpro.serpro.gov.br";

  if (!clientId || !clientSecret) {
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
 * Parse birth date from Serpro response.
 * Trial returns "DDMMYYYY", production may return "DD/MM/YYYY".
 */
function parseBirthDate(nascimento: string): Date {
  const clean = nascimento.replace(/\D/g, "");
  if (clean.length !== 8) {
    throw new Error(`Invalid birth date format: ${nascimento}`);
  }
  const day = parseInt(clean.slice(0, 2), 10);
  const month = parseInt(clean.slice(2, 4), 10);
  const year = parseInt(clean.slice(4, 8), 10);
  return new Date(year, month - 1, day);
}

const statusMap: Record<string, SerproCpfResult["cpfStatus"]> = {
  "0": "regular",
  "1": "null",
  "2": "irregular",
  "3": "cancelled",
  "4": "cancelled", // cancelado por multiplicidade
  "5": "null",      // nulo
  "8": "cancelled", // cancelado de oficio
  "9": "cancelled", // titular falecido
};

/**
 * Query Serpro CPF API for birth date information.
 *
 * Modes:
 * - **trial**: Uses Serpro's public sandbox credentials. Free, returns mock data.
 *   Only works with specific test CPFs (e.g. 40442820135).
 * - **mock**: Local deterministic mock (no network). Set SERPRO_MOCK=true.
 * - **production**: Real Serpro API. Cost: ~R$0.40 per query. Requires SERPRO_CLIENT_ID and SERPRO_CLIENT_SECRET.
 */
export async function queryCpf(cpf: string): Promise<SerproCpfResult> {
  const normalized = cpf.replace(/\D/g, "");

  // Local mock mode for offline development
  if (process.env.SERPRO_MOCK === "true") {
    return getMockResponse(normalized);
  }

  const trial = isTrialMode();
  const apiUrl = process.env.SERPRO_API_URL ?? "https://gateway.apiserpro.serpro.gov.br";
  const apiPath = trial ? TRIAL_CONFIG.apiPath : "consulta-cpf-df";
  const token = await getSerproToken();

  const response = await fetch(
    `${apiUrl}/${apiPath}/v1/cpf/${normalized}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Serpro CPF query failed: ${response.status}`);
  }

  const data = SerproCpfResponse.parse(await response.json());
  const birthDate = parseBirthDate(data.nascimento);

  return {
    birthDate,
    cpfStatus: statusMap[data.situacao.codigo] ?? "irregular",
    name: data.nome,
  };
}

/**
 * Check if Serpro is configured (has credentials via env vars).
 * If not configured, the platform can still use AI-only verification.
 */
export function isSerproConfigured(): boolean {
  // Mock mode counts as "configured"
  if (process.env.SERPRO_MOCK === "true") return true;
  // Trial mode counts as "configured" (free sandbox)
  if (process.env.SERPRO_MODE === "trial") return true;
  // Production mode requires credentials
  return !!(process.env.SERPRO_CLIENT_ID && process.env.SERPRO_CLIENT_SECRET);
}

/**
 * Known test CPFs with fixed ages for demo/testing.
 */
const KNOWN_TEST_CPFS: Record<string, { age: number; name: string }> = {
  "40442820135": { age: 55, name: "Maria Silva" },
  "63017285995": { age: 30, name: "Joao Santos" },
  "91708635203": { age: 17, name: "Ana Oliveira" },
  "58136053391": { age: 14, name: "Pedro Costa" },
  "47123586964": { age: 10, name: "Lucas Ferreira" },
};

function getMockResponse(cpf: string): SerproCpfResult {
  // Check known test CPFs first (for Gov.br demo coherence)
  const known = KNOWN_TEST_CPFS[cpf];
  if (known) {
    const currentYear = new Date().getFullYear();
    return {
      birthDate: new Date(currentYear - known.age, 2, 15),
      cpfStatus: "regular",
      name: known.name,
    };
  }

  // Deterministic mock: last 2 digits of CPF determine birth year
  const lastTwo = parseInt(cpf.slice(-2), 10);
  const currentYear = new Date().getFullYear();
  const age = 5 + Math.floor((lastTwo / 100) * 25);
  const birthYear = currentYear - age;

  return {
    birthDate: new Date(birthYear, 5, 15),
    cpfStatus: "regular",
    name: "Usuario de Teste",
  };
}
