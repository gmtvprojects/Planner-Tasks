import { logout } from "@/app/actions";
import { requireUser } from "@/lib/dal";

export default async function Page() {
  const user = await requireUser();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {user.name}</h1>
        <form action={logout}><button className="text-sm underline">Sair</button></form>
      </header>
      <p className="mt-4 text-zinc-600">Seus quadros aparecerão aqui.</p>
    </main>
  );
}
