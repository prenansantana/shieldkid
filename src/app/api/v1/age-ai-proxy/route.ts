import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/age-ai-proxy
 *
 * Proxy for the Age AI microservice (demo/testing only).
 * Forwards the image to the age-ai container and returns the result.
 */
export async function POST(req: NextRequest) {
  const ageAiUrl = process.env.AGE_AI_URL ?? "http://localhost:8100";

  try {
    const formData = await req.formData();

    const res = await fetch(`${ageAiUrl}/analyze`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Age AI proxy error" },
      { status: 502 }
    );
  }
}
