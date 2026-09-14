"use client";

/**
 * Contact Detail Page
 *
 * Profile info, tags (removable), and recent DM/interaction history.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/status-badge";

interface Tag {
  id: string;
  name: string;
}

interface DmLog {
  id: string;
  commentText: string;
  status: string;
  createdAt: string;
  automation: { name: string };
}

interface ContactDetail {
  id: string;
  username: string | null;
  name: string | null;
  profilePicUrl: string | null;
  followerCount: number | null;
  isVerifiedUser: boolean | null;
  isFollowingBusiness: boolean | null;
  isBusinessFollowingUser: boolean | null;
  lastInteractionAt: string | null;
  profileSyncedAt: string | null;
  tags: Tag[];
  dmLogs: DmLog[];
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${params.id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) setContact(data.data);
    } catch (err) {
      console.error("Failed to fetch contact:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchContact();
  }, [fetchContact]);

  async function removeTag(tagId: string) {
    if (!contact) return;
    setRemovingTagId(tagId);
    try {
      await fetch(`/api/contacts/${contact.id}/tags/${tagId}`, {
        method: "DELETE",
      });
      setContact((prev) =>
        prev ? { ...prev, tags: prev.tags.filter((t) => t.id !== tagId) } : prev
      );
    } catch (err) {
      console.error("Failed to remove tag:", err);
    } finally {
      setRemovingTagId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="panel rounded p-6 h-40" />
        <div className="panel rounded p-6 h-64" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="panel rounded p-12 text-center text-muted">
        Contacto no encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/contacts" className="text-sm text-muted hover:text-foreground">
        ← Volver a contactos
      </Link>

      {/* Profile */}
      <div className="panel rounded p-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contact.profilePicUrl ?? undefined}
            alt=""
            className="h-16 w-16 rounded-full bg-surface-hover object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {contact.username ? `@${contact.username}` : contact.name ?? "Sin nombre"}
              {contact.isVerifiedUser && (
                <span className="ml-2 text-accent text-sm">✓ Verificado</span>
              )}
            </h1>
            {contact.name && contact.username && (
              <p className="text-sm text-muted">{contact.name}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Seguidores</p>
            <p className="text-sm font-medium text-foreground">
              {contact.followerCount ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Te sigue</p>
            <p className="text-sm font-medium text-foreground">
              {contact.isFollowingBusiness == null
                ? "—"
                : contact.isFollowingBusiness
                  ? "Sí"
                  : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Lo sigues</p>
            <p className="text-sm font-medium text-foreground">
              {contact.isBusinessFollowingUser == null
                ? "—"
                : contact.isBusinessFollowingUser
                  ? "Sí"
                  : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wider">Última interacción</p>
            <p className="text-sm font-medium text-foreground">
              {contact.lastInteractionAt
                ? new Date(contact.lastInteractionAt).toLocaleString("es-ES", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-6">
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Etiquetas</p>
          {contact.tags.length === 0 ? (
            <p className="text-sm text-muted">Sin etiquetas</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    disabled={removingTagId === tag.id}
                    aria-label={`Quitar etiqueta ${tag.name}`}
                    className="hover:text-foreground disabled:opacity-40"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interaction history */}
      <div className="panel rounded overflow-hidden">
        <div className="px-4 py-4 border-b border-border sm:px-6">
          <h2 className="text-sm font-semibold text-foreground">Historial reciente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Comentario</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Campaña</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Estado</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contact.dmLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted sm:px-6">
                    Sin actividad todavía
                  </td>
                </tr>
              )}
              {contact.dmLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="px-4 py-4 max-w-[240px] sm:px-6">
                    <span className="text-muted truncate block">{log.commentText}</span>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <span className="text-muted">{log.automation.name}</span>
                  </td>
                  <td className="px-4 py-4 sm:px-6">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-4 text-muted whitespace-nowrap sm:px-6">
                    {new Date(log.createdAt).toLocaleString("es-ES", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
