import type { VerificationResult } from "./types";

export class ApiClient {
  constructor(
    private endpoint: string,
    private token: string
  ) {}

  async verifyCpf(
    cpf: string,
    externalUserId: string
  ): Promise<VerificationResult> {
    const response = await fetch(`${this.endpoint}/api/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ cpf, externalUserId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        (error as { error?: string }).error || `Verification failed: ${response.status}`
      );
    }

    return response.json() as Promise<VerificationResult>;
  }
}
