import crypto from "crypto";
import { prisma } from "@/lib/db/client";

/**
 * Outbound webhooks — best-effort delivery to user-configured endpoints (e.g.
 * a CRM) when something happens in OpenReply. There is no retry queue: a
 * failed delivery is recorded on the OutboundWebhook row (lastStatus/
 * lastError) and surfaced in Settings, but not retried automatically. This
 * matches most CRM webhook receivers, which are simple fire-and-forget POST
 * endpoints, and keeps this feature out of BullMQ's job graph.
 */

const DELIVERY_TIMEOUT_MS = 8000;

export type ContactEvent = "contact.created" | "contact.updated";

export interface ContactEventPayload {
  event: ContactEvent;
  workspaceId: string;
  contact: {
    id: string;
    igsId: string;
    username: string | null;
    name: string | null;
    profilePicUrl: string | null;
    followerCount: number | null;
    isVerifiedUser: boolean | null;
    isFollowingBusiness: boolean | null;
    isBusinessFollowingUser: boolean | null;
    tags: string[];
    createdAt: string;
    lastInteractionAt: string | null;
  };
  sentAt: string;
}

function signPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Reject anything but a plain http(s) URL — this is a user-supplied
 * destination for a self-hosted app, so a basic SSRF guard against loopback/
 * link-local targets is worth the few lines even though the URL is only ever
 * set by the workspace's own owner.
 */
function isSafeWebhookUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false;
  }
  return true;
}

async function deliver(
  webhook: { id: string; url: string; secret: string },
  payload: unknown
): Promise<void> {
  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let status: number | null = null;
  let errorMessage: string | null = null;

  try {
    if (!isSafeWebhookUrl(webhook.url)) {
      throw new Error("Webhook URL is not allowed (must be a public http/https host)");
    }
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenReply-Signature": `sha256=${signPayload(webhook.secret, body)}`,
        "X-OpenReply-Event": (payload as { event?: string }).event ?? "unknown",
      },
      body,
      signal: controller.signal,
    });
    status = response.status;
    if (!response.ok) {
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  } finally {
    clearTimeout(timeout);
  }

  try {
    await prisma.outboundWebhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: status,
        lastError: errorMessage,
      },
    });
  } catch (error) {
    console.log(
      "[OutboundWebhook] Failed to record delivery result:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Fire every enabled webhook for a workspace with the given contact event.
 * All enabled webhooks receive both `contact.created` and `contact.updated`
 * — there's currently no per-webhook event filter, since a CRM sync
 * typically wants both anyway (the `event` column on OutboundWebhook is
 * legacy from an earlier single-event design and unused for filtering).
 * Looks the contact up fresh (by id) so callers never have to assemble the
 * payload themselves or worry about stale data. Fire-and-forget from the
 * caller's perspective — never throws, never awaited by the DM-sending
 * critical path.
 */
export async function triggerContactWebhooks(
  event: ContactEvent,
  contactId: string
): Promise<void> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { tags: { include: { tag: { select: { name: true } } } } },
    });
    if (!contact) return;

    const webhooks = await prisma.outboundWebhook.findMany({
      where: { workspaceId: contact.workspaceId, enabled: true },
    });
    if (webhooks.length === 0) return;

    const payload: ContactEventPayload = {
      event,
      workspaceId: contact.workspaceId,
      contact: {
        id: contact.id,
        igsId: contact.igsId,
        username: contact.username,
        name: contact.name,
        profilePicUrl: contact.profilePicUrl,
        followerCount: contact.followerCount,
        isVerifiedUser: contact.isVerifiedUser,
        isFollowingBusiness: contact.isFollowingBusiness,
        isBusinessFollowingUser: contact.isBusinessFollowingUser,
        tags: contact.tags.map((ct) => ct.tag.name),
        createdAt: contact.createdAt.toISOString(),
        lastInteractionAt: contact.lastInteractionAt?.toISOString() ?? null,
      },
      sentAt: new Date().toISOString(),
    };

    await Promise.all(webhooks.map((webhook) => deliver(webhook, payload)));
  } catch (error) {
    console.log(
      `[OutboundWebhook] Failed to trigger ${event} webhooks:`,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/** Send a synthetic sample payload to one webhook so the user can verify their receiver. */
export async function sendTestWebhook(webhook: {
  id: string;
  url: string;
  secret: string;
  workspaceId: string;
}): Promise<void> {
  const samplePayload: ContactEventPayload = {
    event: "contact.created",
    workspaceId: webhook.workspaceId,
    contact: {
      id: "sample_contact_id",
      igsId: "17841400000000000",
      username: "ejemplo_usuario",
      name: "Usuario de Ejemplo",
      profilePicUrl: null,
      followerCount: 1234,
      isVerifiedUser: false,
      isFollowingBusiness: true,
      isBusinessFollowingUser: false,
      tags: ["Artist"],
      createdAt: new Date().toISOString(),
      lastInteractionAt: new Date().toISOString(),
    },
    sentAt: new Date().toISOString(),
  };
  await deliver(webhook, samplePayload);
}
