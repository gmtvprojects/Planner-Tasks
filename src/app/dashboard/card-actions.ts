"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProjectAccess, requireUser } from "@/lib/dal";

const GAP = 1024;
const text = z.string().trim().min(1).max(2000);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

type Ctx = { cardId: string; projectId: string };

async function cardCtx(cardId: string): Promise<Ctx & Awaited<ReturnType<typeof requireProjectAccess>>> {
  const c = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { projectId: true } } },
  });
  if (!c) throw new Error("Cartão não encontrado");
  const projectId = c.column.projectId;
  return { cardId, projectId, ...(await requireProjectAccess(projectId)) };
}

export type CardDetail = {
  id: string;
  title: string;
  description: string;
  projectId: string;
  createdAt: string;
  events: { id: string; fromTitle: string | null; toTitle: string; userName: string | null; createdAt: string }[];
  labelIds: string[];
  assigneeIds: string[];
  checklist: { id: string; text: string; done: boolean }[];
  comments: { id: string; body: string; createdAt: string; authorId: string; authorName: string }[];
  projectLabels: { id: string; name: string; color: string }[];
  members: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  userId: string;
  canManage: boolean;
};

export async function getCardDetail(cardId: string): Promise<CardDetail> {
  const { projectId, user, canManage } = await cardCtx(cardId);
  const [card, projectLabels, members, projects] = await Promise.all([
    prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: {
        labels: { select: { id: true } },
        assignees: { select: { id: true } },
        checklist: { orderBy: { position: "asc" } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
        events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      },
    }),
    prisma.label.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.project.findMany({
      where: user.isAdmin ? {} : { members: { some: { userId: user.id } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    id: card.id,
    title: card.title,
    description: card.description ?? "",
    projectId,
    createdAt: card.createdAt.toISOString(),
    events: card.events.map((e) => ({
      id: e.id,
      fromTitle: e.fromTitle,
      toTitle: e.toTitle,
      userName: e.user?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    labelIds: card.labels.map((l) => l.id),
    assigneeIds: card.assignees.map((a) => a.id),
    checklist: card.checklist.map((i) => ({ id: i.id, text: i.text, done: i.done })),
    comments: card.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorId: c.author.id,
      authorName: c.author.name,
    })),
    projectLabels,
    members: members.map((m) => ({ id: m.user.id, name: m.user.name })),
    projects,
    userId: user.id,
    canManage,
  };
}

// ---------- Etiquetas ----------

export async function createLabel(projectId: string, name: string, color: string) {
  await requireProjectAccess(projectId);
  return prisma.label.create({
    data: { projectId, name: text.max(40).parse(name), color: hexColor.parse(color) },
    select: { id: true, name: true, color: true },
  });
}

export async function deleteLabel(labelId: string) {
  const l = await prisma.label.findUniqueOrThrow({ where: { id: labelId }, select: { projectId: true } });
  await requireProjectAccess(l.projectId);
  await prisma.label.delete({ where: { id: labelId } });
}

export async function setCardLabels(cardId: string, labelIds: string[]) {
  const { projectId } = await cardCtx(cardId);
  const valid = await prisma.label.findMany({ where: { id: { in: labelIds }, projectId }, select: { id: true } });
  await prisma.card.update({ where: { id: cardId }, data: { labels: { set: valid } } });
}

// ---------- Responsáveis ----------

export async function setCardAssignees(cardId: string, userIds: string[]) {
  const { projectId } = await cardCtx(cardId);
  const valid = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: userIds } },
    select: { userId: true },
  });
  await prisma.card.update({
    where: { id: cardId },
    data: { assignees: { set: valid.map((m) => ({ id: m.userId })) } },
  });
}

// ---------- Projeto ----------

/** Move o cartão para a primeira aba de outro projeto; etiquetas e responsáveis inválidos são removidos. */
export async function moveCardToProject(cardId: string, targetProjectId: string) {
  const { projectId, user } = await cardCtx(cardId);
  if (projectId === targetProjectId) return;
  await requireProjectAccess(targetProjectId);

  const from = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    select: { column: { select: { title: true, project: { select: { name: true } } } } },
  });
  const targetProject = await prisma.project.findUniqueOrThrow({
    where: { id: targetProjectId },
    select: { name: true },
  });
  let column = await prisma.column.findFirst({
    where: { projectId: targetProjectId },
    orderBy: { position: "asc" },
    select: { id: true, title: true },
  });
  if (!column) {
    column = await prisma.column.create({
      data: { projectId: targetProjectId, title: "A fazer", position: GAP },
      select: { id: true, title: true },
    });
  }
  const last = await prisma.card.findFirst({
    where: { columnId: column.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const members = await prisma.projectMember.findMany({
    where: { projectId: targetProjectId },
    select: { userId: true },
  });
  const current = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    select: { assignees: { select: { id: true } } },
  });
  const keep = new Set(members.map((m) => m.userId));
  await prisma.card.update({
    where: { id: cardId },
    data: {
      columnId: column.id,
      position: (last?.position ?? 0) + GAP,
      labels: { set: [] },
      assignees: { set: current.assignees.filter((a) => keep.has(a.id)) },
      events: {
        create: {
          fromTitle: `${from.column.project.name} › ${from.column.title}`,
          toTitle: `${targetProject.name} › ${column.title}`,
          userId: user.id,
        },
      },
    },
  });
}

// ---------- Checklist ----------

export async function addChecklistItem(cardId: string, value: string) {
  await cardCtx(cardId);
  const last = await prisma.checklistItem.findFirst({
    where: { cardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const i = await prisma.checklistItem.create({
    data: { cardId, text: text.parse(value), position: (last?.position ?? 0) + GAP },
  });
  return { id: i.id, text: i.text, done: i.done };
}

async function itemCtx(itemId: string) {
  const i = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId }, select: { cardId: true } });
  await cardCtx(i.cardId);
}

export async function updateChecklistItem(itemId: string, data: { text?: string; done?: boolean }) {
  await itemCtx(itemId);
  await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(data.text !== undefined ? { text: text.parse(data.text) } : {}),
      ...(data.done !== undefined ? { done: !!data.done } : {}),
    },
  });
}

export async function deleteChecklistItem(itemId: string) {
  await itemCtx(itemId);
  await prisma.checklistItem.delete({ where: { id: itemId } });
}

// ---------- Comentários ----------

export async function addComment(cardId: string, body: string) {
  const { user } = await cardCtx(cardId);
  const c = await prisma.comment.create({
    data: { cardId, authorId: user.id, body: text.max(5000).parse(body) },
  });
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorId: user.id,
    authorName: user.name,
  };
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const c = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    select: { authorId: true, card: { select: { column: { select: { projectId: true } } } } },
  });
  const access = await requireProjectAccess(c.card.column.projectId);
  if (c.authorId !== user.id && !access.canManage) throw new Error("Sem permissão");
  await prisma.comment.delete({ where: { id: commentId } });
}
