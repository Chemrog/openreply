import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { decryptToken } from "@/lib/meta/oauth";
import { sendDirectMessage, MetaApiError } from "@/lib/meta/client";
import {
  reserveWorkspaceDMSend,
  releaseWorkspaceDMReservation,
} from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

/**
 * Public integration API — lets an external system (typically a CRM) send a
 * DM to a contact through OpenReply, authenticated with the workspace's API
 * key (Settings → API). This is the inbound half of the CRM integration; the
 * outbound half is the OutboundWebhook feature (lib/integrations/outbound-webhooks.ts).
 *
 * Important constraint this endpoint cannot work around: Instagram only
 * allows sending free-form text to a user within the 24-hour messaging
 * window after they last messaged the business account. A send outside that
 * window is rejected by Meta, not by OpenReply — surfaced here as a 422 with
 * `reason: "outside_messaging_window"` so the caller can distinguish it from
 * other failures.
 */

async function resolveWorkspaceByApiKey(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const apiKey = bearerKey || request.headers.get("x-api-key");
  if (!apiKey) return null;

  return prisma.workspace.findUnique({ where: { apiKey } });
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspaceByApiKey(request);
  if (!workspace) {
    return NextResponse.json(
      { success: false, error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const igsId = typeof body?.igsId === "string" ? body.igsId.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const instagramAccountId =
    typeof body?.instagramAccountId === "string" ? body.instagramAccountId : undefined;

  if (!igsId || !text) {
    return NextResponse.json(
      { success: false, error: "'igsId' and 'text' are required" },
      { status: 400 }
    );
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { success: false, error: "'text' must be 1000 characters or fewer" },
      { status: 400 }
    );
  }

  const account = instagramAccountId
    ? await prisma.instagramAccount.findFirst({
        where: { id: instagramAccountId, workspaceId: workspace.id },
      })
    : await prisma.instagramAccount.findFirst({
        where: { workspaceId: workspace.id },
        orderBy: { connectedAt: "desc" },
      });

  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error: instagramAccountId
          ? "instagramAccountId does not belong to this workspace"
          : "No Instagram account connected to this workspace",
      },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(account.accessToken);
  } catch {
    return NextResponse.json(
      { success: false, error: "Instagram account token could not be decrypted" },
      { status: 500 }
    );
  }

  const usage = await reserveWorkspaceDMSend(workspace.id);
  if (!usage.allowed) {
    return NextResponse.json(
      { success: false, error: "Workspace DM sending limit reached" },
      { status: 429 }
    );
  }

  try {
    const result = await sendDirectMessage(accessToken, account.instagramId, igsId, text);
    return NextResponse.json({
      success: true,
      data: { messageId: result.message_id, recipientId: result.recipient_id },
    });
  } catch (error) {
    await releaseWorkspaceDMReservation(workspace.id, usage.periodStart);

    if (error instanceof MetaApiError) {
      const outsideWindow = /outside of allowed window|24[- ]hour/i.test(error.message);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          reason: outsideWindow ? "outside_messaging_window" : "meta_api_error",
        },
        { status: outsideWindow ? 422 : 502 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 502 }
    );
  }
}
