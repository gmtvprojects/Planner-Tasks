import Link from "next/link";
import { logout } from "@/app/actions";
import { createBoard } from "@/app/boards/actions";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { BoardCardActions } from "./board-actions";

export default async function Page() {
  const user = await requireUser();
  const memberships = await prisma.boardMember.findMany({
    where: { userId: user.id },
    include: { board: { include: { _count: { select: { columns: true } } } } },
    orderBy: { board: { createdAt: "desc" } },
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Planner <span className="text-muted">| Tasks</span></p>
          <h1 className="mt-1 text-3xl font-black">
            Olá, <span className="text-brand">{user.name}</span>
          </h1>
        </div>
        <form action={logout}><button className="link text-sm">Sair</button></form>
      </header>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-extrabold">Novo quadro</h2>
        <form action={createBoard} className="flex flex-col gap-2 sm:flex-row">
          <input name="name" required placeholder="Nome do quadro" className="field flex-1" />
          <input
            name="columns"
            placeholder="Abas separadas por vírgula (padrão: A fazer, Em andamento, Concluído)"
            className="field flex-[2]"
          />
          <button className="btn-primary">Criar</button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-extrabold">Seus quadros</h2>
        {memberships.length === 0 && <p className="text-muted">Nenhum quadro ainda.</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {memberships.map(({ board, role }) => (
            <li key={board.id} className="panel relative p-4 transition hover:border-brand">
              <Link
                href={`/boards/${board.id}`}
                className="text-lg font-bold after:absolute after:inset-0 after:content-[''] hover:text-brand"
              >
                {board.name}
              </Link>
              <p className="text-sm text-muted">{board._count.columns} abas</p>
              <BoardCardActions id={board.id} name={board.name} isOwner={role === "OWNER"} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
