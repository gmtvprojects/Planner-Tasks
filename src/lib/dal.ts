import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const getCurrentUser = cache(async () => {
  const id = await getSessionUserId();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Apenas administradores");
  return user;
}

/**
 * Acesso a um projeto: admins acessam todos; os demais precisam ser membros.
 * `canManage` = admin global ou líder do projeto (gerencia membros).
 */
export async function getProjectAccess(projectId: string) {
  const user = await requireUser();
  if (user.isAdmin) return { user, canManage: true };
  const m = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!m) return null;
  return { user, canManage: m.role === "LEAD" };
}

export async function requireProjectAccess(projectId: string) {
  const access = await getProjectAccess(projectId);
  if (!access) throw new Error("Sem acesso a este projeto");
  return access;
}
