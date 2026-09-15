import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

// Escape a value for CSV: wrap in quotes and double up any embedded quotes.
// Also guards against formula injection in spreadsheet apps (Excel/Sheets
// execute a leading =, +, -, @ as a formula) by prefixing those with a tab.
function csvCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(str)) str = `\t${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

const HEADERS = [
  "username",
  "name",
  "igsId",
  "tags",
  "follower_count",
  "is_verified_user",
  "follows_you",
  "you_follow_them",
  "last_interaction_at",
  "created_at",
];

// Exports every contact matching the current search/tag filter as CSV — no
// pagination cap here, this is a full download, not a page of the table.
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

  const where = {
    workspaceId,
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    ...(search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      tags: { include: { tag: { select: { name: true } } } },
    },
    orderBy: { lastInteractionAt: "desc" },
  });

  const rows = contacts.map((c) =>
    [
      c.username ?? "",
      c.name ?? "",
      c.igsId,
      c.tags.map((ct) => ct.tag.name).join("; "),
      c.followerCount ?? "",
      c.isVerifiedUser ?? "",
      c.isFollowingBusiness ?? "",
      c.isBusinessFollowingUser ?? "",
      c.lastInteractionAt ? c.lastInteractionAt.toISOString() : "",
      c.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(",")
  );

  // Leading BOM so Excel opens the UTF-8 file with accents intact.
  const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
  const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
