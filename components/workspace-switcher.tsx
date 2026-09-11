"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  switchWorkspace,
  createWorkspace,
} from "@/app/(dashboard)/workspace-actions";

interface WorkspaceItem {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string;
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  function handleSwitch(id: string) {
    if (id === activeWorkspaceId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchWorkspace(id);
      setOpen(false);
    });
  }

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await createWorkspace(trimmed);
      setNewName("");
      setCreating(false);
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="w-full text-left px-5 py-4 border-t border-border hover:bg-surface-hover transition-colors"
      >
        <p className="text-sm text-foreground truncate flex items-center justify-between">
          <span className="truncate">{active?.name ?? "Workspace"}</span>
          <svg
            className={`w-4 h-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </p>
        <p className="text-xs text-muted">Self-hosted</p>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-48 overflow-y-auto py-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                disabled={isPending}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors ${
                  ws.id === activeWorkspaceId
                    ? "text-foreground font-medium bg-surface-hover"
                    : "text-muted"
                }`}
              >
                <span className="truncate block">{ws.name}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-border">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                className="flex items-center gap-2 p-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  maxLength={50}
                  disabled={isPending}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-foreground"
                />
                <button
                  type="submit"
                  disabled={isPending || !newName.trim()}
                  className="px-3 py-1.5 text-sm font-medium bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
                >
                  Create
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                disabled={isPending}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                + New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
