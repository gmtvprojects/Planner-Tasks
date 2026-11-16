import Link from "next/link";
import { logout } from "@/app/actions";
import { getProjectAccess, requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { ProjectSelect } from "./project-select";
import { MembrosTab, ProjetosTab, QuadroTab, ReunioesTab } from "./_tabs/tabs";

const LABELS = {
  quadro: "Quadro",
  membros: "Membros",
  reunioes: "Reuniões",
  projetos: "Projetos",
} as const;
type Tab = keyof typeof LABELS;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; p?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const projects = await prisma.project.findMany({
    where: user.isAdmin ? {} : { members: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const project = projects.find((p) => p.id === sp.p) ?? projects[0];

  // Sem projetos (e sem ser admin) a tela aparece sem abas e sem projetos.
  const tabs: Tab[] = [
    ...(project ? (["quadro", "membros", "reunioes"] as const) : []),
    ...(user.isAdmin ? (["projetos"] as const) : []),
  ];
  const tab = tabs.find((t) => t === sp.tab) ?? tabs[0];
  const access = project ? await getProjectAccess(project.id) : null;
  const href = (t: Tab) => `/dashboard?tab=${t}${project ? `&p=${project.id}` : ""}`;

  return (
    <main className="mx-auto flex h-screen w-full max-w-[1400px] flex-col p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">
            Planner <span className="text-muted">| Tasks</span>
          </p>
          <h1 className="mt-1 text-2xl font-black">
            Olá, <span className="text-brand">{user.name}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* No Quadro o seletor de projeto fica na barra de filtros */}
          {project && tab && tab !== "quadro" && (
            <ProjectSelect projects={projects} current={project.id} tab={tab} />
          )}
          <form action={logout}>
            <button className="link text-sm">Sair</button>
          </form>
        </div>
      </header>

      {tabs.length > 0 && (
        <nav className="mt-6 flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
          {tabs.map((t) => (
            <Link
              key={t}
              href={href(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold whitespace-nowrap transition ${
                t === tab ? "border-brand text-brand" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {LABELS[t]}
            </Link>
          ))}
        </nav>
      )}

      <section className="mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "quadro" && project && <QuadroTab projects={projects} />}
        {tab === "membros" && project && access && (
          <MembrosTab projectId={project.id} canManage={access.canManage} userId={user.id} />
        )}
        {tab === "reunioes" && project && access && (
          <ReunioesTab projectId={project.id} canManage={access.canManage} userId={user.id} />
        )}
        {tab === "projetos" && user.isAdmin && <ProjetosTab />}
      </section>
    </main>
  );
}
