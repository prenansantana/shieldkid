import type { ShieldKidConfig, VerificationResult, VerificationMethod } from "./types";
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
    padding: 32px; max-width: 420px; width: 90%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    position: relative;
  }
  .sk-title {
    font-size: 20px; font-weight: 600; margin: 0 0 8px; color: #111;
  }
  .sk-subtitle {
    font-size: 14px; color: #666; margin: 0 0 24px; line-height: 1.4;
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
  .sk-btn-secondary {
    width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;
    background: white; color: #333;
    font-size: 14px; font-weight: 500; cursor: pointer;
    margin-top: 8px;
  }
  .sk-btn-secondary:hover { background: #f9f9f9; }
  .sk-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
  .sk-footer {
    text-align: center; margin-top: 16px;
    font-size: 12px; color: #999;
  }
  .sk-camera-wrap {
    width: 100%; aspect-ratio: 4/3; background: #000;
    border-radius: 8px; overflow: hidden; position: relative;
    margin-bottom: 16px;
  }
  .sk-camera-wrap video, .sk-camera-wrap img {
    width: 100%; height: 100%; object-fit: cover;
  }
  .sk-camera-wrap video { transform: scaleX(-1); }
  .sk-camera-placeholder {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
    color: #666; font-size: 14px;
  }
  .sk-camera-guide {
    position: absolute; inset: 15%; border: 2px dashed rgba(255,255,255,0.4);
    border-radius: 50%; pointer-events: none;
  }
  .sk-camera-actions { display: flex; gap: 8px; }
  .sk-camera-actions .sk-btn { flex: 1; margin-top: 0; }
  .sk-camera-actions .sk-btn-secondary { flex: 0 0 auto; margin-top: 0; padding: 12px 16px; width: auto; }
  .sk-spinner {
    display: inline-block; width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white; border-radius: 50%;
    animation: sk-spin 0.6s linear infinite;
    vertical-align: middle; margin-right: 8px;
  }
  @keyframes sk-spin { to { transform: rotate(360deg); } }
  .sk-hidden { display: none !important; }
`;

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const TEXTS = {
  "pt-BR": {
    title: "Verificação de Idade",
    subtitleCpf: "Para continuar, precisamos verificar sua idade conforme a Lei Felca.",
    subtitleFace: "Tire uma selfie para verificarmos sua idade conforme a Lei Felca.",
    subtitleBoth: "Informe seu CPF e tire uma selfie para verificação de idade.",
    cpfPlaceholder: "000.000.000-00",
    startCamera: "Abrir câmera",
    capture: "Tirar foto",
    retake: "Tirar outra",
    verify: "Verificar",
    verifying: "Verificando...",
    footer: "Seus dados são protegidos conforme a LGPD.",
    cameraError: "Não foi possível acessar a câmera.",
    noFace: "Nenhum rosto detectado. Tente novamente.",
  },
  en: {
    title: "Age Verification",
    subtitleCpf: "To continue, we need to verify your age per Brazilian law.",
    subtitleFace: "Take a selfie so we can verify your age per Brazilian law.",
    subtitleBoth: "Enter your CPF and take a selfie for age verification.",
    cpfPlaceholder: "000.000.000-00",
    startCamera: "Open camera",
    capture: "Take photo",
    retake: "Retake",
    verify: "Verify",
    verifying: "Verifying...",
    footer: "Your data is protected under LGPD.",
    cameraError: "Could not access the camera.",
    noFace: "No face detected. Please try again.",
  },
};

export class ShieldKid {
  private config: ShieldKidConfig;
  private client: ApiClient;
  private shadowRoot: ShadowRoot | null = null;
  private stream: MediaStream | null = null;
  private sessionId: string | null = null;

  constructor(config: ShieldKidConfig) {
    this.config = config;
    this.client = new ApiClient(config.endpoint, config.token);

    if (config.token.startsWith("sk_secret_")) {
      console.warn(
        "[ShieldKid] You are using a secret key (sk_secret_xxx) in client-side code. " +
        "This is insecure — anyone can extract it from the browser. " +
        "Use a publishable key (sk_pub_xxx) instead. " +
        "See: https://github.com/shieldkid/shieldkid#security"
      );
    }
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
      throw new Error("externalUserId obrigatório");
    }

    const method: VerificationMethod = this.config.method ?? "face";

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

    const locale = this.config.locale ?? "pt-BR";
    const t = TEXTS[locale];

    const overlay = document.createElement("div");
    overlay.className = "sk-overlay";

    const subtitle =
      method === "cpf" ? t.subtitleCpf
      : method === "face" ? t.subtitleFace
      : t.subtitleBoth;

    const showCpf = method === "cpf" || method === "cpf+face";
    const showCamera = method === "face" || method === "cpf+face";

    overlay.innerHTML = `
      <div class="sk-card">
        <h2 class="sk-title">${t.title}</h2>
        <p class="sk-subtitle">${subtitle}</p>

        ${showCpf ? `
          <input class="sk-input sk-cpf-input" type="text"
            placeholder="${t.cpfPlaceholder}" inputmode="numeric" maxlength="14" />
        ` : ""}

        ${showCamera ? `
          <div class="sk-camera-wrap">
            <video class="sk-video" autoplay playsinline muted></video>
            <img class="sk-preview sk-hidden" alt="selfie" />
            <div class="sk-camera-placeholder sk-placeholder-msg">${t.startCamera}</div>
            <div class="sk-camera-guide sk-hidden"></div>
          </div>
          <div class="sk-camera-actions">
            <button class="sk-btn sk-btn-start">${t.startCamera}</button>
            <button class="sk-btn sk-btn-capture sk-hidden">${t.capture}</button>
            <button class="sk-btn-secondary sk-btn-retake sk-hidden">${t.retake}</button>
          </div>
        ` : ""}

        <div class="sk-error" style="display:none"></div>

        ${!showCamera ? `
          <button class="sk-btn sk-btn-verify">${t.verify}</button>
        ` : `
          <button class="sk-btn sk-btn-verify sk-hidden">${t.verify}</button>
        `}

        <p class="sk-footer">${t.footer}</p>
      </div>
    `;

    // Elements
    const cpfInput = overlay.querySelector(".sk-cpf-input") as HTMLInputElement | null;
    const errorEl = overlay.querySelector(".sk-error") as HTMLDivElement;
    const verifyBtn = overlay.querySelector(".sk-btn-verify") as HTMLButtonElement;

    // Camera elements
    const video = overlay.querySelector(".sk-video") as HTMLVideoElement | null;
    const preview = overlay.querySelector(".sk-preview") as HTMLImageElement | null;
    const placeholderMsg = overlay.querySelector(".sk-placeholder-msg") as HTMLDivElement | null;
    const guide = overlay.querySelector(".sk-camera-guide") as HTMLDivElement | null;
    const startBtn = overlay.querySelector(".sk-btn-start") as HTMLButtonElement | null;
    const captureBtn = overlay.querySelector(".sk-btn-capture") as HTMLButtonElement | null;
    const retakeBtn = overlay.querySelector(".sk-btn-retake") as HTMLButtonElement | null;

    let capturedBlob: Blob | null = null;

    // CPF formatting
    if (cpfInput) {
      cpfInput.addEventListener("input", () => {
        const pos = cpfInput.selectionStart ?? 0;
        const oldLen = cpfInput.value.length;
        cpfInput.value = formatCpf(cpfInput.value);
        const newLen = cpfInput.value.length;
        cpfInput.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
      });
    }

    // Camera flow
    if (showCamera && video && startBtn && captureBtn && retakeBtn && preview && placeholderMsg && guide) {
      const startCamera = async () => {
        try {
          // Create a session token before opening the camera
          // This ensures only our SDK can submit images
          this.sessionId = await this.client.createSession();

          this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
          video.srcObject = this.stream;
          video.classList.remove("sk-hidden");
          preview.classList.add("sk-hidden");
          placeholderMsg.classList.add("sk-hidden");
          guide.classList.remove("sk-hidden");
          startBtn.classList.add("sk-hidden");
          captureBtn.classList.remove("sk-hidden");
          retakeBtn.classList.add("sk-hidden");
          verifyBtn.classList.add("sk-hidden");
          errorEl.style.display = "none";
        } catch {
          errorEl.textContent = t.cameraError;
          errorEl.style.display = "block";
        }
      };

      const stopCamera = () => {
        if (this.stream) {
          this.stream.getTracks().forEach((tr) => tr.stop());
          this.stream = null;
        }
        video.srcObject = null;
      };

      const capture = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        // Mirror the capture to match the mirrored preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) return;
          capturedBlob = blob;
          preview.src = URL.createObjectURL(blob);
          preview.classList.remove("sk-hidden");
          video.classList.add("sk-hidden");
          guide.classList.add("sk-hidden");
          captureBtn.classList.add("sk-hidden");
          retakeBtn.classList.remove("sk-hidden");
          verifyBtn.classList.remove("sk-hidden");
          stopCamera();
        }, "image/jpeg", 0.9);
      };

      startBtn.addEventListener("click", startCamera);
      captureBtn.addEventListener("click", capture);
      retakeBtn.addEventListener("click", () => {
        capturedBlob = null;
        if (preview.src) URL.revokeObjectURL(preview.src);
        preview.src = "";
        verifyBtn.classList.add("sk-hidden");
        startCamera();
      });

      // Auto-start camera
      startCamera();
    }

    // Verify
    verifyBtn.addEventListener("click", async () => {
      errorEl.style.display = "none";

      // Validate CPF if needed
      let cpf: string | undefined;
      if (showCpf && cpfInput) {
        cpf = cpfInput.value.replace(/\D/g, "");
        if (cpf.length !== 11) {
          errorEl.textContent = locale === "pt-BR" ? "CPF deve ter 11 dígitos" : "CPF must have 11 digits";
          errorEl.style.display = "block";
          return;
        }
      }

      // Validate image if needed
      if (showCamera && !capturedBlob) {
        errorEl.textContent = locale === "pt-BR" ? "Tire uma selfie primeiro" : "Take a selfie first";
        errorEl.style.display = "block";
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerHTML = `<span class="sk-spinner"></span>${t.verifying}`;

      try {
        let result: VerificationResult;

        if (capturedBlob && this.sessionId) {
          // Multipart with SDK session (with or without CPF)
          result = await this.client.verifyFace(capturedBlob, userId, this.sessionId, cpf);
        } else {
          // CPF only
          result = await this.client.verifyCpf(cpf!, userId);
        }

        this.stopStream();
        this.close(host);

        if (result.isMinor && this.config.onMinor) {
          this.config.onMinor(result);
        }
        if (this.config.onVerified) {
          this.config.onVerified(result);
        }
      } catch (err) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = t.verify;
        errorEl.textContent = err instanceof Error ? err.message : "Verificação falhou";
        errorEl.style.display = "block";

        if (this.config.onError) {
          this.config.onError(err instanceof Error ? err : new Error("Verificação falhou"));
        }
      }
    });

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && this.config.mode !== "gate") {
        this.stopStream();
        this.close(host);
      }
    });

    this.shadowRoot.appendChild(overlay);
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((tr) => tr.stop());
      this.stream = null;
    }
  }

  private close(host: HTMLElement): void {
    host.remove();
    this.shadowRoot = null;
  }
}
