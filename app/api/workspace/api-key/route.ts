import crypto from "crypto";
import { NextResponse } from "next/server";
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

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { apiKey: true },
  });

  return NextResponse.json({ success: true, data: { apiKey: workspace?.apiKey ?? null } });
}

// Generates a new key, replacing any existing one (old key stops working
// immediately — the caller must update their CRM integration).
export async function POST() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const apiKey = `or_${crypto.randomBytes(24).toString("hex")}`;
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { apiKey },
  });

  return NextResponse.json({ success: true, data: { apiKey } });
}
