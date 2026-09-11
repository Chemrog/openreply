"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

interface WorkspaceItem {
  id: string;
  name: string;
  role: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function DashboardShell({
  children,
  workspaces,
  activeWorkspaceId,
  instagramUsername,
  instagramAccountCount,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // h-dvh, not h-screen: on mobile browsers the URL bar eats into 100vh, which
    // would push the composer and pagination controls below the fold.
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          instagramUsername={instagramUsername}
          instagramAccountCount={instagramAccountCount}
        />

        {/* overflow-x-hidden: enabling vertical scrolling makes the browser
            allow horizontal scrolling too, which lets a wide child drag the
            whole page sideways on a phone. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 lg:px-8 py-5 sm:py-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
