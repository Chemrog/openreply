import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const webhooks = await prisma.outboundWebhook.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: webhooks });
}

export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { success: false, error: "URL inválida" },
      { status: 400 }
    );
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { success: false, error: "La URL debe empezar con http:// o https://" },
      { status: 400 }
    );
  }

  const webhook = await prisma.outboundWebhook.create({
    data: {
      workspaceId,
      url,
      secret: crypto.randomBytes(24).toString("hex"),
      event: "contact.created",
    },
  });

  return NextResponse.json({ success: true, data: webhook });
}
