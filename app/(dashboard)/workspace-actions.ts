"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import {
  getWorkspaceForUser,
  setActiveWorkspaceId,
} from "@/lib/workspace";

export async function switchWorkspace(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const ws = await getWorkspaceForUser(session.user.id, workspaceId);
  if (!ws) throw new Error("Not a member of this workspace");

  await setActiveWorkspaceId(workspaceId);
  revalidatePath("/");
}

export async function createWorkspace(name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50) throw new Error("Invalid name");

  const workspace = await prisma.workspace.create({
    data: {
      name: trimmed,
      ownerId: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
  });

  await setActiveWorkspaceId(workspace.id);
  revalidatePath("/");
  return { id: workspace.id, name: workspace.name };
}
