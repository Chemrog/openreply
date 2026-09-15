"use client";

/**
 * Outbound Webhooks Settings
 *
 * Lets the workspace owner point OpenReply at an external endpoint (e.g. a
 * CRM) that gets POSTed a JSON payload whenever a new Contact is created.
 * Includes the payload schema inline so the user can configure their
 * receiver without leaving the page.
 */

import { useEffect, useState } from "react";

interface OutboundWebhook {
  id: string;
  url: string;
  secret: string;
  event: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
}

const SAMPLE_PAYLOAD = {
  event: "contact.created",
  workspaceId: "ws_...",
  contact: {
    id: "clx...",
    igsId: "17841400000000000",
    username: "ejemplo_usuario",
    name: "Usuario de Ejemplo",
    profilePicUrl: "https://... (puede venir null, y expira en días)",
    followerCount: 1234,
    isVerifiedUser: false,
    isFollowingBusiness: true,
    isBusinessFollowingUser: false,
    tags: ["Artist"],
    createdAt: "2026-09-15T13:59:00.000Z",
    lastInteractionAt: "2026-09-15T13:59:00.000Z",
  },
  sentAt: "2026-09-15T13:59:01.000Z",
};

export default function OutboundWebhooksSettings() {
  const [webhooks, setWebhooks] = useState<OutboundWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  async function fetchWebhooks() {
    const res = await fetch("/api/webhooks/outbound", { cache: "no-store" });
    const data = await res.json();
    if (data.success) setWebhooks(data.data);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchWebhooks().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createWebhook(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!newUrl.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/webhooks/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "No se pudo crear el webhook");
      setWebhooks((prev) => [...prev, data.data]);
      setNewUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el webhook");
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(webhook: OutboundWebhook) {
    setBusyId(webhook.id);
    try {
      const res = await fetch(`/api/webhooks/outbound/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === webhook.id ? data.data : w))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function testWebhook(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/webhooks/outbound/${id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setWebhooks((prev) => prev.map((w) => (w.id === id ? data.data : w)));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm("¿Eliminar este webhook?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/webhooks/outbound/${id}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="h-32" />;

  return (
    <section className="panel rounded p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Webhooks salientes</h2>
          <p className="mt-0.5 text-xs text-muted">
            Envía un POST a tu CRM cada vez que llega un contacto nuevo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSchema((s) => !s)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-border-hover hover:text-foreground"
        >
          {showSchema ? "Ocultar formato" : "¿Cómo configurar mi CRM?"}
        </button>
      </div>

      {showSchema && (
        <div className="mb-6 rounded-lg border border-border bg-surface/70 p-4 text-xs">
          <p className="mb-2 text-muted">
            Cada vez que llega un contacto nuevo (sin importar si viene de una
            automatización o de un mensaje directo cualquiera), hacemos un{" "}
            <code className="rounded bg-surface-hover px-1">POST</code> con este
            cuerpo JSON:
          </p>
          <pre className="overflow-x-auto rounded bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300">
            {JSON.stringify(SAMPLE_PAYLOAD, null, 2)}
          </pre>
          <p className="mt-3 text-muted">
            Cada request incluye dos headers para que puedas verificar/rutear:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
            <li>
              <code className="rounded bg-surface-hover px-1">X-OpenReply-Event</code>
              : el nombre del evento (hoy solo <code>contact.created</code>).
            </li>
            <li>
              <code className="rounded bg-surface-hover px-1">
                X-OpenReply-Signature
              </code>
              : <code>sha256=&lt;hmac hex&gt;</code> — el HMAC-SHA256 del cuerpo
              exacto del request, firmado con el <em>secret</em> de tu webhook
              (lo ves al crearlo). Verifícalo antes de confiar en el payload.
            </li>
          </ul>
          <p className="mt-3 text-muted">
            No reintentamos entregas fallidas automáticamente — si tu endpoint
            está caído, el último error queda guardado abajo. Usa &quot;Probar&quot;
            para verificar tu receptor en cualquier momento.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.length === 0 && (
          <p className="py-4 text-sm text-muted">
            Aún no tienes webhooks configurados.
          </p>
        )}
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="rounded border border-border bg-surface/70 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {webhook.url}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {webhook.event} ·{" "}
                  {webhook.lastTriggeredAt ? (
                    <>
                      última entrega{" "}
                      {new Date(webhook.lastTriggeredAt).toLocaleString("es-ES")}
                      {" — "}
                      {webhook.lastError ? (
                        <span className="text-error">{webhook.lastError}</span>
                      ) : (
                        <span className="text-success">
                          OK ({webhook.lastStatus})
                        </span>
                      )}
                    </>
                  ) : (
                    "sin entregas todavía"
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleEnabled(webhook)}
                  disabled={busyId === webhook.id}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    webhook.enabled
                      ? "border-success/20 text-success hover:bg-success/10"
                      : "border-border text-muted hover:border-border-hover hover:text-foreground"
                  }`}
                >
                  {webhook.enabled ? "Activo" : "Pausado"}
                </button>
                <button
                  type="button"
                  onClick={() => testWebhook(webhook.id)}
                  disabled={busyId === webhook.id}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-border-hover hover:text-foreground disabled:opacity-50"
                >
                  Probar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRevealSecret((cur) =>
                      cur === webhook.id ? null : webhook.id
                    )
                  }
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-border-hover hover:text-foreground"
                >
                  Secret
                </button>
                <button
                  type="button"
                  onClick={() => deleteWebhook(webhook.id)}
                  disabled={busyId === webhook.id}
                  className="rounded-lg border border-error/20 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
            {revealSecret === webhook.id && (
              <p className="mt-3 break-all rounded bg-black/40 px-3 py-2 font-mono text-[11px] text-zinc-300">
                {webhook.secret}
              </p>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={createWebhook}
        className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row"
      >
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://tu-crm.com/webhooks/openreply"
          className="flex-1 rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
        />
        <button
          type="submit"
          disabled={creating || !newUrl.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {creating ? "Agregando..." : "+ Agregar webhook"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </section>
  );
}
