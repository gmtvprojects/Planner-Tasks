"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/dal";

const GAP = 1024;
const title = z.string().trim().min(1).max(200);

async function assertBoardAccess(boardId: string) {
  const user = await requireUser();
  const m = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  if (!m) throw new Error("Sem acesso a este quadro");
  return { user, role: m.role };
}

async function boardIdOfColumn(columnId: string) {
  const c = await prisma.column.findUnique({ where: { id: columnId }, select: { boardId: true } });
  if (!c) throw new Error("Coluna não encontrada");
  return c.boardId;
}

async function boardIdOfCard(cardId: string) {
  const c = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { boardId: true } } },
  });
  if (!c) throw new Error("Cartão não encontrado");
  return c.column.boardId;
}

// ---------- Quadros ----------

export async function createBoard(formData: FormData) {
  const user = await requireUser();
  const name = title.parse(formData.get("name"));
  const raw = String(formData.get("columns") ?? "");
  let names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) names = ["A fazer", "Em andamento", "Concluído"];

  const board = await prisma.board.create({
    data: {
      name,
      members: { create: { userId: user.id, role: "OWNER" } },
      columns: { create: names.map((t, i) => ({ title: t, position: (i + 1) * GAP })) },
    },
  });
  redirect(`/boards/${board.id}`);
}

export async function renameBoard(boardId: string, name: string) {
  await assertBoardAccess(boardId);
  await prisma.board.update({ where: { id: boardId }, data: { name: title.parse(name) } });
  revalidatePath("/dashboard");
}

export async function deleteBoard(boardId: string) {
  const { role } = await assertBoardAccess(boardId);
  if (role !== "OWNER") throw new Error("Só o dono pode excluir o quadro");
  await prisma.board.delete({ where: { id: boardId } });
  revalidatePath("/dashboard");
}

// ---------- Colunas (abas) ----------

export async function createColumn(boardId: string, name: string) {
  await assertBoardAccess(boardId);
  const last = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return prisma.column.create({
    data: { boardId, title: title.parse(name), position: (last?.position ?? 0) + GAP },
    select: { id: true, title: true, position: true },
  });
}

export async function renameColumn(columnId: string, name: string) {
  await assertBoardAccess(await boardIdOfColumn(columnId));
  await prisma.column.update({ where: { id: columnId }, data: { title: title.parse(name) } });
}

export async function moveColumn(columnId: string, position: number) {
  await assertBoardAccess(await boardIdOfColumn(columnId));
  await prisma.column.update({ where: { id: columnId }, data: { position } });
}

export async function deleteColumn(columnId: string) {
  await assertBoardAccess(await boardIdOfColumn(columnId));
  await prisma.column.delete({ where: { id: columnId } });
}

// ---------- Cartões ----------

export async function createCard(columnId: string, name: string) {
  await assertBoardAccess(await boardIdOfColumn(columnId));
  const last = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return prisma.card.create({
    data: { columnId, title: title.parse(name), position: (last?.position ?? 0) + GAP },
    select: { id: true, title: true, description: true, position: true },
  });
}

export async function updateCard(cardId: string, data: { title: string; description: string }) {
  await assertBoardAccess(await boardIdOfCard(cardId));
  await prisma.card.update({
    where: { id: cardId },
    data: { title: title.parse(data.title), description: data.description.trim() || null },
  });
}

export async function moveCard(cardId: string, columnId: string, position: number) {
  const boardId = await boardIdOfCard(cardId);
  await assertBoardAccess(boardId);
  if ((await boardIdOfColumn(columnId)) !== boardId) throw new Error("Coluna de outro quadro");
  await prisma.card.update({ where: { id: cardId }, data: { columnId, position } });
}

export async function deleteCard(cardId: string) {
  await assertBoardAccess(await boardIdOfCard(cardId));
  await prisma.card.delete({ where: { id: cardId } });
}
