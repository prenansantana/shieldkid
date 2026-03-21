/**
 * Client for the Age AI microservice (InsightFace).
 *
 * Takes a selfie image, sends it to the age-ai container,
 * returns the estimated age of the primary face detected.
 */

type AgeAiFace = {
  age: number;
  gender: "M" | "F";
  bbox: number[];
  confidence: number;
};

type AgeAiResponse = {
  faces: AgeAiFace[];
  face_count: number;
  processing_ms: number;
  error?: string;
};

export type AgeEstimationResult = {
  estimatedAge: number;
  gender: "M" | "F";
  confidence: number;
  processingMs: number;
};

function getAgeAiUrl(): string {
  return process.env.AGE_AI_URL ?? "http://localhost:8100";
}

/**
 * Check if the Age AI service is available.
 */
export async function isAgeAiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${getAgeAiUrl()}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = (await res.json()) as { status: string; model_loaded: boolean };
    return data.status === "ok" && data.model_loaded;
  } catch {
    return false;
  }
}

/**
 * Estimate age from a selfie image.
 *
 * @param imageBuffer - Raw image bytes (JPEG, PNG, or WebP)
 * @returns Estimated age of the primary face, or null if no face detected
 */
export async function estimateAge(
  imageBuffer: Buffer
): Promise<AgeEstimationResult | null> {
  const formData = new FormData();
  formData.append(
    "image",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }),
    "selfie.jpg"
  );

  const res = await fetch(`${getAgeAiUrl()}/analyze`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Age AI service error: ${res.status}`);
  }

  const data = (await res.json()) as AgeAiResponse;

  if (data.face_count === 0 || data.faces.length === 0) {
    return null;
  }

  // Use the face with highest confidence
  const primary = data.faces[0]!;

  return {
    estimatedAge: primary.age,
    gender: primary.gender,
    confidence: primary.confidence,
    processingMs: data.processing_ms,
  };
}

/**
 * Compare the AI-estimated age with the CPF-verified age.
 * Returns whether the ages are consistent (within tolerance).
 *
 * Tolerance logic:
 * - InsightFace has MAE of ~7 years, so we use generous bounds
 * - The key is catching a 10-year-old using a 40-year-old's CPF
 * - Not catching a 16-year-old using an 18-year-old's CPF (too close)
 */
export function isAgeConsistent(
  verifiedAge: number,
  estimatedAge: number
): { consistent: boolean; difference: number; suspicious: boolean } {
  const difference = Math.abs(verifiedAge - estimatedAge);

  // Dynamic tolerance based on the verified age
  // Younger people: tighter tolerance (easier to tell a kid from adult)
  // Older people: more tolerance (harder to distinguish 30 vs 40)
  let tolerance: number;
  if (verifiedAge < 13) {
    tolerance = 8; // Must look roughly like a child
  } else if (verifiedAge < 18) {
    tolerance = 10; // Teen zone, some margin
  } else {
    tolerance = 15; // Adult, wide margin
  }

  const consistent = difference <= tolerance;

  // Suspicious: AI says clearly minor but CPF says adult (or vice versa)
  const aiSaysMinor = estimatedAge < 16;
  const cpfSaysAdult = verifiedAge >= 18;
  const aiSaysAdult = estimatedAge >= 25;
  const cpfSaysChild = verifiedAge < 13;

  const suspicious =
    (aiSaysMinor && cpfSaysAdult) || (aiSaysAdult && cpfSaysChild);

  return { consistent, difference, suspicious };
}
