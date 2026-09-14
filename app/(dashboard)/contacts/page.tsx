"use client";

/**
 * Contacts Page
 *
 * Filterable, paginated table of contacts synced from inbound DMs/comments.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Tag {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  username: string | null;
  name: string | null;
  profilePicUrl: string | null;
  followerCount: number | null;
  lastInteractionAt: string | null;
  tags: Tag[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (tagFilter) params.set("tag", tagFilter);

      const res = await fetch(`/api/contacts?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setContacts(data.data.contacts);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, tagFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetchContacts();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [fetchContacts]);

  // Every tag seen across the loaded page, for the filter pill row.
  const allTags = Array.from(
    new Map(
      contacts.flatMap((c) => c.tags).map((t) => [t.id, t])
    ).values()
  );

  return (
    <div className="space-y-6">
      {/* Search + tag filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Buscar por usuario o nombre…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none sm:max-w-xs"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setTagFilter("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tagFilter === ""
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "bg-surface text-muted border border-border hover:border-border-hover hover:text-foreground"
              }`}
            >
              Todas
            </button>
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setTagFilter(tag.name);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tagFilter === tag.name
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "bg-surface text-muted border border-border hover:border-border-hover hover:text-foreground"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="panel rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Contacto</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Etiquetas</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Seguidores</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Última interacción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-4 py-4 sm:px-6">
                        <div className="h-4 bg-surface-hover rounded" />
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {!loading && contacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted sm:px-6">
                    Aún no tienes contactos — aparecerán aquí cuando alguien te escriba
                  </td>
                </tr>
              )}
              {!loading &&
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-4 sm:px-6">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="flex items-center gap-3 font-medium text-foreground hover:text-accent"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={contact.profilePicUrl ?? undefined}
                          alt=""
                          className="h-8 w-8 rounded-full bg-surface-hover object-cover"
                          onError={(e) => {
                            e.currentTarget.style.visibility = "hidden";
                          }}
                        />
                        <span>
                          {contact.username
                            ? `@${contact.username}`
                            : contact.name ?? contact.id.slice(0, 8)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted sm:px-6">
                      {contact.followerCount ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-muted whitespace-nowrap sm:px-6">
                      {contact.lastInteractionAt
                        ? new Date(contact.lastInteractionAt).toLocaleString("es-ES", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-t border-border sm:px-6">
            <p className="text-xs text-muted">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{" "}
              {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage(page - 1);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-foreground hover:border-border-hover transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Anterior
              </button>
              <span className="text-xs text-muted px-2">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage(page + 1);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-foreground hover:border-border-hover transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
