"use client";

/**
 * API Key Settings
 *
 * Lets the workspace owner generate a bearer key for the public
 * /api/v1/messages endpoint — the inbound half of a CRM integration: the CRM
 * calls OpenReply, OpenReply relays to Instagram.
 */

import { useEffect, useState } from "react";

export default function ApiKeySettings() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/workspace/api-key", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setApiKey(data.data.apiKey);
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function regenerate() {
    if (
      apiKey &&
      !confirm(
        "Esto invalida la API key actual de inmediato. Cualquier integración usando la anterior dejará de funcionar. ¿Continuar?"
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/workspace/api-key", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setApiKey(data.data.apiKey);
        setRevealed(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://tu-dominio.com";
  const curlExample = `curl -X POST ${origin}/api/v1/messages \\
  -H "Authorization: Bearer ${apiKey ?? "<TU_API_KEY>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"igsId": "17841400000000000", "text": "Hola desde el CRM"}'`;

  if (loading) return <div className="h-32" />;

  return (
    <section className="panel rounded p-4 sm:p-6">
      <h2 className="text-base font-semibold mb-1">API para integraciones</h2>
      <p className="mb-6 text-xs text-muted">
        Deja que tu CRM mande mensajes de Instagram a través de OpenReply.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">API Key</p>
          {apiKey ? (
            <p className="mt-1 break-all font-mono text-xs text-muted">
              {revealed ? apiKey : `${apiKey.slice(0, 7)}${"•".repeat(20)}`}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">Aún no has generado una</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {apiKey && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-border-hover hover:text-foreground"
            >
              {revealed ? "Ocultar" : "Mostrar"}
            </button>
          )}
          {apiKey && revealed && (
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(apiKey)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-border-hover hover:text-foreground"
            >
              Copiar
            </button>
          )}
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-border-hover hover:text-foreground disabled:opacity-50"
          >
            {busy ? "Generando…" : apiKey ? "Regenerar" : "Generar API Key"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface/70 p-4 text-xs">
        <p className="mb-2 text-muted">
          Con esa key, tu CRM puede mandar un mensaje directo a cualquier
          contacto (por su <code className="rounded bg-surface-hover px-1">igsId</code>,
          el mismo que recibes en el webhook de contactos):
        </p>
        <pre className="overflow-x-auto rounded bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300">
          {curlExample}
        </pre>
        <p className="mt-3 font-medium text-foreground">Importante — ventana de 24 horas</p>
        <p className="mt-1 text-muted">
          Instagram (no OpenReply) solo permite mandar texto libre a alguien
          que te escribió en las últimas 24 horas. Si el contacto no ha
          escrito recientemente, el envío se rechaza con{" "}
          <code className="rounded bg-surface-hover px-1">422</code> y{" "}
          <code className="rounded bg-surface-hover px-1">
            reason: &quot;outside_messaging_window&quot;
          </code>{" "}
          — es la política de Meta, no un límite de esta API.
        </p>
        {!apiKey && (
          <p className="mt-3 text-muted">
            Genera tu API key arriba para activar este endpoint.
          </p>
        )}
      </div>
    </section>
  );
}
