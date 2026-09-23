import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * ManyChat → OpenReply contact import endpoint.
 *
 * ManyChat's API has no "list all subscribers" endpoint, so the only path to
 * bulk-migrate a large contact list is to trigger an "External Request" step
 * from a ManyChat Flow — one HTTP POST per subscriber, sent to this route.
 * A broadcast to "All contacts" then fires that flow for the entire audience.
 *
 * Auth: workspace API key (Settings → API), sent as `Authorization: Bearer …`
 * or `x-api-key: …` — same scheme as /api/v1/messages.
 *
 * Body (JSON) — all keys accept both snake_case and camelCase:
 *   ig_id              (string, required)  Instagram Scoped ID of the subscriber
 *   ig_username        (string, optional)  @-handle without the @
 *   name               (string, optional)  Display name
 *   tags               (string[] | string, optional) tag names; strings are split on ","
 *   instagram_account_id (string, optional) which connected IG account this
 *                        contact belongs to; if omitted and the workspace has
 *                        exactly one account, that one is used.
 */

async function resolveWorkspaceByApiKey(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const apiKey = bearerKey || request.headers.get("x-api-key");
  if (!apiKey) return null;
  return prisma.workspace.findUnique({ where: { apiKey } });
}

function pickString(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeTags(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const flat = list.flatMap((entry) =>
    typeof entry === "string"
      ? entry.split(",")
      : typeof entry === "number"
        ? [String(entry)]
        : []
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of flat) {
    const clean = t.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspaceByApiKey(request);
  if (!workspace) {
    return NextResponse.json(
      { success: false, error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) {
    return NextResponse.json(
      { success: false, error: "Body must be JSON" },
      { status: 400 }
    );
  }

  const igsId = pickString(body, "ig_id", "igId", "igsId", "subscriber_id");
  if (!igsId) {
    return NextResponse.json(
      { success: false, error: "'ig_id' is required" },
      { status: 400 }
    );
  }

  const username = pickString(body, "ig_username", "igUsername", "username");
  const name = pickString(body, "name", "full_name", "fullName");
  const tags = normalizeTags(body.tags ?? (body as Record<string, unknown>).tag);
  const requestedAccountId = pickString(
    body,
    "instagram_account_id",
    "instagramAccountId"
  );

  const account = requestedAccountId
    ? await prisma.instagramAccount.findFirst({
        where: { id: requestedAccountId, workspaceId: workspace.id },
      })
    : await prisma.instagramAccount.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { connectedAt: "desc" },
      });

  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error: requestedAccountId
          ? "instagram_account_id does not belong to this workspace"
          : "No Instagram account connected to this workspace",
      },
      { status: 400 }
    );
  }

  // Upsert contact by (workspaceId, igsId). We only overwrite optional fields
  // when the caller actually provided a value, so a second call that omits
  // username won't erase one captured earlier by the webhook path.
  const contact = await prisma.contact.upsert({
    where: { workspaceId_igsId: { workspaceId: workspace.id, igsId } },
    create: {
      workspaceId: workspace.id,
      instagramAccountId: account.id,
      igsId,
      username: username || null,
      name: name || null,
    },
    update: {
      instagramAccountId: account.id,
      ...(username ? { username } : {}),
      ...(name ? { name } : {}),
    },
  });

  const addedTagNames: string[] = [];
  for (const tagName of tags) {
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: tagName } },
      create: { workspaceId: workspace.id, name: tagName },
      update: {},
    });
    // A duplicate ContactTag insert would throw on the unique index; catch it
    // so re-imports of the same subscriber stay idempotent without a lookup.
    try {
      await prisma.contactTag.create({
        data: { contactId: contact.id, tagId: tag.id },
      });
      addedTagNames.push(tagName);
    } catch {
      // Already attached — treat as success.
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      contactId: contact.id,
      igsId: contact.igsId,
      username: contact.username,
      tagsAdded: addedTagNames,
      totalTags: tags.length,
    },
  });
}
