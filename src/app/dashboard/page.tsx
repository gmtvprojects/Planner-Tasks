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

  const input = "rounded border border-zinc-300 px-3 py-2 text-black";
  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {user.name}</h1>
        <form action={logout}><button className="text-sm underline">Sair</button></form>
      </header>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-medium">Novo quadro</h2>
        <form action={createBoard} className="flex flex-col gap-2 sm:flex-row">
          <input name="name" required placeholder="Nome do quadro" className={`${input} flex-1`} />
          <input
            name="columns"
            placeholder="Abas separadas por vírgula (padrão: A fazer, Em andamento, Concluído)"
            className={`${input} flex-[2]`}
          />
          <button className="rounded bg-blue-600 px-4 py-2 text-white">Criar</button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-medium">Seus quadros</h2>
        {memberships.length === 0 && <p className="text-zinc-500">Nenhum quadro ainda.</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {memberships.map(({ board, role }) => (
            <li key={board.id} className="rounded border border-zinc-300 p-4">
              <Link href={`/boards/${board.id}`} className="text-lg font-medium hover:underline">
                {board.name}
              </Link>
              <p className="text-sm text-zinc-500">{board._count.columns} abas</p>
              <BoardCardActions id={board.id} name={board.name} isOwner={role === "OWNER"} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
