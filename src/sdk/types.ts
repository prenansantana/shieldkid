export type AgeBracket = "child" | "teen_12_15" | "teen_16_17" | "adult";

export type VerificationMethod = "cpf" | "face" | "cpf+face";

export interface ShieldKidConfig {
  /** URL of your ShieldKid instance */
  endpoint: string;
  /**
   * API token for authentication.
   * Use a publishable key (sk_pub_xxx) for client-side / browser code.
   * Never use your secret key (sk_secret_xxx) in client-side code.
   */
  token: string;
  /**
   * Verification method:
   * - "cpf": CPF input only (requires Serpro)
   * - "face": Selfie camera only (requires age-ai service)
   * - "cpf+face": CPF + selfie cross-check (both services)
   * Default: "face"
   */
  method?: VerificationMethod;
  /** Widget behavior: "gate" blocks dismissal, "inline" allows close */
  mode?: "gate" | "inline";
  /** External user ID in your platform */
  externalUserId?: string;
  /** Custom container element (default: creates modal) */
  container?: HTMLElement;
  /** Callbacks */
  onVerified?: (result: VerificationResult) => void;
  onMinor?: (result: VerificationResult) => void;
  onError?: (error: Error) => void;
  /** Customization */
  theme?: {
    primaryColor?: string;
    fontFamily?: string;
    borderRadius?: string;
  };
  /** Language (default: pt-BR) */
  locale?: "pt-BR" | "en";
}

export interface VerificationResult {
  verificationId: string;
  ageBracket: AgeBracket;
  age: number;
  isAdult: boolean;
  isMinor: boolean;
  requiresGuardian: boolean;
  source: string;
  cpfStatus?: string;
  estimatedAge?: number;
  confidence?: number;
  action?: "allow" | "flag" | "block";
  consistent?: boolean;
}
