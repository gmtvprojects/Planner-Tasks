"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireProjectAccess } from "@/lib/dal";

const GAP = 1024;
const title = z.string().trim().min(1).max(200);

async function projectIdOfColumn(columnId: string) {
  const c = await prisma.column.findUnique({ where: { id: columnId }, select: { projectId: true } });
  if (!c) throw new Error("Aba não encontrada");
  return c.projectId;
}

async function projectIdOfCard(cardId: string) {
  const c = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { projectId: true } } },
  });
  if (!c) throw new Error("Cartão não encontrado");
  return c.column.projectId;
}

async function requireManage(projectId: string) {
  const access = await requireProjectAccess(projectId);
  if (!access.canManage) throw new Error("Apenas líderes e administradores");
  return access;
}

// ---------- Projetos (somente admin) ----------

export async function createProject(formData: FormData) {
  await requireAdmin();
  const name = title.parse(formData.get("name"));
  const raw = String(formData.get("columns") ?? "");
  let names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) names = ["A fazer", "Em andamento", "Concluído"];

  const project = await prisma.project.create({
    data: { name, columns: { create: names.map((t, i) => ({ title: t, position: (i + 1) * GAP })) } },
  });
  redirect(`/dashboard?tab=projetos&p=${project.id}`);
}

export async function renameProject(projectId: string, name: string) {
  await requireAdmin();
  await prisma.project.update({ where: { id: projectId }, data: { name: title.parse(name) } });
  revalidatePath("/dashboard");
}

export async function deleteProject(projectId: string) {
  await requireAdmin();
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
}

// ---------- Membros ----------

export async function addMember(projectId: string, email: string) {
  await requireManage(projectId);
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { error: "Nenhum usuário cadastrado com esse e-mail" };
  const exists = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (exists) return { error: "Essa pessoa já é membro do projeto" };
  await prisma.projectMember.create({ data: { projectId, userId: user.id } });
  revalidatePath("/dashboard");
  return {};
}

export async function setMemberRole(projectId: string, userId: string, role: "LEAD" | "MEMBER") {
  await requireManage(projectId);
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role: z.enum(["LEAD", "MEMBER"]).parse(role) },
  });
  revalidatePath("/dashboard");
}

export async function removeMember(projectId: string, userId: string) {
  await requireManage(projectId);
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  revalidatePath("/dashboard");
}

// ---------- Reuniões ----------

const meetingSchema = z.object({
  title,
  date: z.string().min(1).transform((s) => new Date(s)).refine((d) => !isNaN(d.getTime()), "Data inválida"),
  notes: z.string().trim().max(20000).optional(),
});

export type MeetingInput = { title: string; date: string; notes: string; attendeeIds: string[] };

async function validAttendees(projectId: string, ids: string[]) {
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: ids } },
    select: { userId: true },
  });
  return members.map((m) => ({ id: m.userId }));
}

export async function createMeeting(projectId: string, input: MeetingInput) {
  const { user } = await requireProjectAccess(projectId);
  const data = meetingSchema.parse(input);
  await prisma.meeting.create({
    data: {
      projectId,
      title: data.title,
      date: data.date,
      notes: data.notes || null,
      createdById: user.id,
      attendees: { connect: await validAttendees(projectId, input.attendeeIds) },
    },
  });
  revalidatePath("/dashboard");
}

async function meetingWithAccess(meetingId: string) {
  const m = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!m) throw new Error("Reunião não encontrada");
  const access = await requireProjectAccess(m.projectId);
  return { meeting: m, ...access };
}

export async function updateMeeting(meetingId: string, input: MeetingInput) {
  const { meeting } = await meetingWithAccess(meetingId);
  const data = meetingSchema.parse(input);
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      title: data.title,
      date: data.date,
      notes: data.notes || null,
      attendees: { set: await validAttendees(meeting.projectId, input.attendeeIds) },
    },
  });
  revalidatePath("/dashboard");
}

export async function deleteMeeting(meetingId: string) {
  const { meeting, user, canManage } = await meetingWithAccess(meetingId);
  if (!canManage && meeting.createdById !== user.id) {
    throw new Error("Só quem criou a reunião ou um líder pode excluí-la");
  }
  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/dashboard");
}

// ---------- Abas do quadro (colunas) ----------

export async function createColumn(projectId: string, name: string) {
  await requireProjectAccess(projectId);
  const last = await prisma.column.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return prisma.column.create({
    data: { projectId, title: title.parse(name), position: (last?.position ?? 0) + GAP },
    select: { id: true, title: true, position: true },
  });
}

export async function renameColumn(columnId: string, name: string) {
  await requireProjectAccess(await projectIdOfColumn(columnId));
  await prisma.column.update({ where: { id: columnId }, data: { title: title.parse(name) } });
}

export async function moveColumn(columnId: string, position: number) {
  await requireProjectAccess(await projectIdOfColumn(columnId));
  await prisma.column.update({ where: { id: columnId }, data: { position } });
}

export async function deleteColumn(columnId: string) {
  await requireProjectAccess(await projectIdOfColumn(columnId));
  await prisma.column.delete({ where: { id: columnId } });
}

// ---------- Cartões ----------

export async function createCard(columnId: string, name: string) {
  await requireProjectAccess(await projectIdOfColumn(columnId));
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
  await requireProjectAccess(await projectIdOfCard(cardId));
  await prisma.card.update({
    where: { id: cardId },
    data: { title: title.parse(data.title), description: data.description.trim() || null },
  });
}

export async function moveCard(cardId: string, columnId: string, position: number) {
  const projectId = await projectIdOfCard(cardId);
  await requireProjectAccess(projectId);
  if ((await projectIdOfColumn(columnId)) !== projectId) throw new Error("Aba de outro projeto");
  await prisma.card.update({ where: { id: cardId }, data: { columnId, position } });
}

export async function deleteCard(cardId: string) {
  await requireProjectAccess(await projectIdOfCard(cardId));
  await prisma.card.delete({ where: { id: cardId } });
}

