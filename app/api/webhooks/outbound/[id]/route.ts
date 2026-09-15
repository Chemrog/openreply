import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const existing = await prisma.outboundWebhook.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Webhook not found" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  const data: { enabled?: boolean; url?: string } = {};
  if (typeof body?.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body?.url === "string" && body.url.trim()) {
    try {
      new URL(body.url.trim());
      data.url = body.url.trim();
    } catch {
      return NextResponse.json(
        { success: false, error: "URL inválida" },
        { status: 400 }
      );
    }
  }

  const webhook = await prisma.outboundWebhook.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, data: webhook });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const existing = await prisma.outboundWebhook.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Webhook not found" },
      { status: 404 }
    );
  }

  await prisma.outboundWebhook.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { deleted: true } });
}
