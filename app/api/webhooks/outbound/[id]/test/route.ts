import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { sendTestWebhook } from "@/lib/integrations/outbound-webhooks";

export async function POST(
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
  const webhook = await prisma.outboundWebhook.findFirst({
    where: { id, workspaceId },
  });
  if (!webhook) {
    return NextResponse.json(
      { success: false, error: "Webhook not found" },
      { status: 404 }
    );
  }

  await sendTestWebhook(webhook);

  const updated = await prisma.outboundWebhook.findUnique({ where: { id } });
  return NextResponse.json({ success: true, data: updated });
}
