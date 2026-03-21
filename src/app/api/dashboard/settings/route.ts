import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { setting, apiToken } from "@/server/db/schema";
import { auth } from "@/server/lib/auth";
import { encrypt, decrypt } from "@/server/lib/crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [settings] = await db.select().from(setting).limit(1);
  const tokens = await db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      lastUsedAt: apiToken.lastUsedAt,
      createdAt: apiToken.createdAt,
    })
    .from(apiToken);

  return NextResponse.json({
    settings: settings
      ? {
          serproApiUrl: settings.serproApiUrl,
          serproClientId: settings.serproClientId ?? "",
          webhookUrl: settings.webhookUrl ?? "",
          webhookSecret: settings.webhookSecret ? decrypt(settings.webhookSecret) : "",
          webhookEvents: settings.webhookEvents ?? [],
          sdkAllowedOrigins: settings.sdkAllowedOrigins ?? [],
        }
      : null,
    tokens,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const [existing] = await db.select().from(setting).limit(1);

  const values: Record<string, unknown> = {
    serproApiUrl: body.serproApiUrl,
    webhookUrl: body.webhookUrl ?? null,
    webhookSecret: body.webhookSecret ? encrypt(body.webhookSecret) : null,
    webhookEvents: body.webhookEvents ?? [],
    sdkAllowedOrigins: body.sdkAllowedOrigins ?? [],
    updatedAt: new Date(),
  };

  if (body.serproClientId !== undefined) {
    values.serproClientId = body.serproClientId || null;
  }
  if (body.serproClientSecret) {
    values.serproClientSecret = encrypt(body.serproClientSecret);
  }

  if (existing) {
    await db.update(setting).set(values).where(eq(setting.id, existing.id));
  } else {
    await db.insert(setting).values(values);
  }

  return NextResponse.json({ ok: true });
}
