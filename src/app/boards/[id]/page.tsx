import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { Kanban } from "./kanban";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const board = await prisma.board.findFirst({
    where: { id, members: { some: { userId: user.id } } },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, description: true, position: true },
          },
        },
      },
    },
  });
  if (!board) notFound();

  return (
    <main className="flex h-screen flex-col p-4">
      <header className="mb-4 flex items-center gap-4">
        <Link href="/dashboard" className="link text-sm">← Quadros</Link>
        <h1 className="text-2xl font-black">{board.name}</h1>
      </header>
      <Kanban
        boardId={board.id}
        initial={board.columns.map((c) => ({ id: c.id, title: c.title, position: c.position, cards: c.cards }))}
      />
    </main>
  );
}
