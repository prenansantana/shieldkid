import type { ShieldKidConfig, VerificationResult } from "./types";
import { ApiClient } from "./api-client";

const STYLES = `
  .sk-overlay {
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.5); display: flex;
    align-items: center; justify-content: center;
    font-family: var(--sk-font, system-ui, -apple-system, sans-serif);
  }
  .sk-card {
    background: white; border-radius: var(--sk-radius, 12px);
    padding: 32px; max-width: 400px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .sk-title {
    font-size: 20px; font-weight: 600; margin: 0 0 8px; color: #111;
  }
  .sk-subtitle {
    font-size: 14px; color: #666; margin: 0 0 24px;
  }
  .sk-input {
    width: 100%; padding: 12px 16px; border: 1px solid #ddd;
    border-radius: 8px; font-size: 16px; outline: none;
    box-sizing: border-box;
  }
  .sk-input:focus { border-color: var(--sk-primary, #2563eb); }
  .sk-btn {
    width: 100%; padding: 12px; border: none; border-radius: 8px;
    background: var(--sk-primary, #2563eb); color: white;
    font-size: 16px; font-weight: 500; cursor: pointer;
    margin-top: 16px;
  }
  .sk-btn:hover { opacity: 0.9; }
  .sk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sk-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
  .sk-footer {
    text-align: center; margin-top: 16px;
    font-size: 12px; color: #999;
  }
`;

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export class ShieldKid {
  private config: ShieldKidConfig;
  private client: ApiClient;
  private shadowRoot: ShadowRoot | null = null;

  constructor(config: ShieldKidConfig) {
    this.config = config;
    this.client = new ApiClient(config.endpoint, config.token);
  }

  static init(config: ShieldKidConfig): ShieldKid {
    return new ShieldKid(config);
  }

  /**
   * Open the verification widget.
   */
  open(externalUserId?: string): void {
    const userId = externalUserId ?? this.config.externalUserId;
    if (!userId) {
      throw new Error("externalUserId is required");
    }

    // Create Shadow DOM host
    const host = document.createElement("div");
    document.body.appendChild(host);
    this.shadowRoot = host.attachShadow({ mode: "closed" });

    // Inject styles
    const style = document.createElement("style");
    style.textContent = STYLES;
    if (this.config.theme?.primaryColor) {
      style.textContent += `:host { --sk-primary: ${this.config.theme.primaryColor}; }`;
    }
    if (this.config.theme?.fontFamily) {
      style.textContent += `:host { --sk-font: ${this.config.theme.fontFamily}; }`;
    }
    if (this.config.theme?.borderRadius) {
      style.textContent += `:host { --sk-radius: ${this.config.theme.borderRadius}; }`;
    }
    this.shadowRoot.appendChild(style);

    // Build UI
    const overlay = document.createElement("div");
    overlay.className = "sk-overlay";

    const locale = this.config.locale ?? "pt-BR";
    const texts =
      locale === "pt-BR"
        ? {
            title: "Verificação de Idade",
            subtitle:
              "Para continuar, precisamos verificar sua idade conforme a Lei Felca.",
            placeholder: "000.000.000-00",
            button: "Verificar",
            verifying: "Verificando...",
            footer: "Seus dados são protegidos conforme a LGPD.",
          }
        : {
            title: "Age Verification",
            subtitle:
              "To continue, we need to verify your age per Brazilian law.",
            placeholder: "000.000.000-00",
            button: "Verify",
            verifying: "Verifying...",
            footer: "Your data is protected under LGPD.",
          };

    overlay.innerHTML = `
      <div class="sk-card">
        <h2 class="sk-title">${texts.title}</h2>
        <p class="sk-subtitle">${texts.subtitle}</p>
        <input class="sk-input" type="text" placeholder="${texts.placeholder}" inputmode="numeric" maxlength="14" />
        <div class="sk-error" style="display:none"></div>
        <button class="sk-btn">${texts.button}</button>
        <p class="sk-footer">${texts.footer}</p>
      </div>
    `;

    const input = overlay.querySelector(".sk-input") as HTMLInputElement;
    const btn = overlay.querySelector(".sk-btn") as HTMLButtonElement;
    const errorEl = overlay.querySelector(".sk-error") as HTMLDivElement;

    // CPF formatting
    input.addEventListener("input", () => {
      const pos = input.selectionStart ?? 0;
      const oldLen = input.value.length;
      input.value = formatCpf(input.value);
      const newLen = input.value.length;
      input.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
    });

    // Submit
    btn.addEventListener("click", async () => {
      const cpf = input.value.replace(/\D/g, "");
      if (cpf.length !== 11) {
        errorEl.textContent =
          locale === "pt-BR"
            ? "CPF deve ter 11 dígitos"
            : "CPF must have 11 digits";
        errorEl.style.display = "block";
        return;
      }

      btn.disabled = true;
      btn.textContent = texts.verifying;
      errorEl.style.display = "none";

      try {
        const result = await this.client.verifyCpf(cpf, userId);
        this.close(host);

        if (result.isMinor && this.config.onMinor) {
          this.config.onMinor(result);
        }
        if (this.config.onVerified) {
          this.config.onVerified(result);
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = texts.button;
        errorEl.textContent =
          err instanceof Error ? err.message : "Verification failed";
        errorEl.style.display = "block";

        if (this.config.onError) {
          this.config.onError(
            err instanceof Error ? err : new Error("Verification failed")
          );
        }
      }
    });

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && this.config.mode !== "gate") {
        this.close(host);
      }
    });

    this.shadowRoot.appendChild(overlay);
  }

  private close(host: HTMLElement): void {
    host.remove();
    this.shadowRoot = null;
  }
}
