import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

// Contacts change on every inbound DM/comment, so never cache this list.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const tag = searchParams.get("tag");
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10))
  );
  const skip = (page - 1) * limit;

  const where = {
    workspaceId,
    ...(tag
      ? { tags: { some: { tag: { name: tag } } } }
      : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
      orderBy: { lastInteractionAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json(
    {
      success: true,
      data: {
        contacts: contacts.map((contact) => ({
          ...contact,
          tags: contact.tags.map((ct) => ct.tag),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
