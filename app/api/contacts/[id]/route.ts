import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(
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

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
    include: {
      tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });

  if (!contact) {
    return NextResponse.json(
      { success: false, error: "Contact not found" },
      { status: 404 }
    );
  }

  // Best-effort recent interaction history — a missing DmLog table entry
  // (e.g. for a contact created outside a comment flow) should never break
  // the detail view.
  let dmLogs: Awaited<ReturnType<typeof prisma.dmLog.findMany>> = [];
  try {
    dmLogs = await prisma.dmLog.findMany({
      where: { workspaceId, commenterId: contact.igsId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    dmLogs = [];
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        ...contact,
        tags: contact.tags.map((ct) => ct.tag),
        dmLogs,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
