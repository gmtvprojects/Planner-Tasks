import { createProject } from "@/app/dashboard/actions";
import { prisma } from "@/lib/db";
import { Kanban } from "./kanban";
import { Meetings } from "./meetings-ui";
import { AddMember, MembersList, type MemberT } from "./members-ui";
import { ProjectActions } from "./projects-ui";

async function loadMembers(projectId: string): Promise<MemberT[]> {
  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({ userId: r.userId, name: r.user.name, email: r.user.email, role: r.role }));
}

export async function QuadroTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const columns = await prisma.column.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    include: {
      cards: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          labels: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
          assignees: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        },
      },
    },
  });
  return (
    <Kanban
      key={projectId}
      projectId={projectId}
      projectName={projectName}
      initial={columns.map((c) => ({ id: c.id, title: c.title, position: c.position, cards: c.cards }))}
    />
  );
}

export async function MembrosTab({
  projectId,
  canManage,
  userId,
}: {
  projectId: string;
  canManage: boolean;
  userId: string;
}) {
  const members = await loadMembers(projectId);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-3 text-lg font-extrabold">Membros do projeto</h2>
      <div className="panel p-4">
        <MembersList projectId={projectId} members={members} canManage={canManage} currentUserId={userId} />
        {canManage && <AddMember projectId={projectId} />}
      </div>
      {!canManage && (
        <p className="mt-2 text-sm text-muted">Apenas líderes e administradores podem alterar os membros.</p>
      )}
    </div>
  );
}

export async function ReunioesTab({
  projectId,
  canManage,
  userId,
}: {
  projectId: string;
  canManage: boolean;
  userId: string;
}) {
  const [meetings, members] = await Promise.all([
    prisma.meeting.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      include: { attendees: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    }),
    loadMembers(projectId),
  ]);
  return (
    <Meetings
      projectId={projectId}
      userId={userId}
      canManage={canManage}
      members={members.map((m) => ({ userId: m.userId, name: m.name }))}
      meetings={meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date.toISOString(),
        notes: m.notes,
        createdById: m.createdById,
        attendees: m.attendees,
      }))}
    />
  );
}

export async function ProjetosTab() {
  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { columns: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section>
        <h2 className="mb-3 text-lg font-extrabold">Novo projeto</h2>
        <form action={createProject} className="flex flex-col gap-2 sm:flex-row">
          <input name="name" required placeholder="Nome do projeto" className="field flex-1" />
          <button className="btn-primary">Criar</button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-extrabold">Projetos</h2>
        {projects.length === 0 && <p className="text-muted">Nenhum projeto criado ainda.</p>}
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id} className="panel flex items-center justify-between gap-2 p-4">
              <div>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-sm text-muted">{p._count.columns} abas</p>
              </div>
              <ProjectActions id={p.id} name={p.name} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
