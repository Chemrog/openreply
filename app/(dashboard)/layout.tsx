import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import {
  ensureWorkspaceForUser,
  getActiveWorkspaceId,
  getUserWorkspaces,
  getWorkspaceForUser,
} from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  let workspace = null;
  const activeId = await getActiveWorkspaceId();
  if (activeId) {
    workspace = await getWorkspaceForUser(userId, activeId);
  }
  if (!workspace) {
    workspace = await ensureWorkspaceForUser(userId, session.user.email);
  }

  const workspaces = await getUserWorkspaces(userId);
  const accounts = await prisma.instagramAccount.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { connectedAt: "desc" },
    select: { username: true },
  });

  return (
    <DashboardShell
      workspaces={workspaces}
      activeWorkspaceId={workspace.id}
      instagramUsername={accounts[0]?.username ?? null}
      instagramAccountCount={accounts.length}
    >
      {children}
    </DashboardShell>
  );
}
