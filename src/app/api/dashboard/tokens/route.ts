import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiToken } from "@/server/db/schema";
import { hashToken } from "@/server/lib/crypto";
import { auth } from "@/server/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const token = `sk_${randomBytes(24).toString("hex")}`;
  const tokenHash = hashToken(token);

  await db.insert(apiToken).values({
    name,
    tokenHash,
  });

  return NextResponse.json({ token });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  await db.delete(apiToken).where(eq(apiToken.id, id));

  return NextResponse.json({ ok: true });
}
