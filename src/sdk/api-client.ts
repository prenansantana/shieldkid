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

  /**
   * Create a short-lived session for camera verification.
   * Must be called before verifyFace().
   */
  async createSession(): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/v1/verify/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        (error as { error?: string }).error || `Session creation failed: ${response.status}`
      );
    }

    const data = (await response.json()) as { sessionId: string; expiresAt: number };
    return data.sessionId;
  }

  async verifyFace(
    imageBlob: Blob,
    externalUserId: string,
    sessionId: string,
    cpf?: string
  ): Promise<VerificationResult> {
    const formData = new FormData();
    formData.append("image", imageBlob, "selfie.jpg");
    formData.append("externalUserId", externalUserId);
    formData.append("sessionId", sessionId);
    if (cpf) {
      formData.append("cpf", cpf);
    }

    const response = await fetch(`${this.endpoint}/api/v1/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
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
