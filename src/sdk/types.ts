export type AgeBracket = "child" | "teen_12_15" | "teen_16_17" | "adult";

export interface ShieldKidConfig {
  /** URL of your ShieldKid instance */
  endpoint: string;
  /** API token (sk_xxx) */
  token: string;
  /** Verification mode */
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
  cpfStatus: string;
}
