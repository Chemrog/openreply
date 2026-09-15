import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { triggerContactWebhooks } from "@/lib/integrations/outbound-webhooks";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id, tagId } = await params;

  // Verify the contact belongs to the caller's workspace before touching
  // anything — never trust the id in the URL alone.
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });

  if (!contact) {
    return NextResponse.json(
      { success: false, error: "Contact not found" },
      { status: 404 }
    );
  }

  await prisma.contactTag.deleteMany({
    where: { contactId: contact.id, tagId },
  });

  void triggerContactWebhooks("contact.updated", contact.id).catch(() => {});

  return NextResponse.json({ success: true, data: { deleted: true } });
}
