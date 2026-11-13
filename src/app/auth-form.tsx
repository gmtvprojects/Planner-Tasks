"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState(isSignup ? signup : login, undefined);
  const field = "w-full rounded border border-zinc-300 px-3 py-2 text-black";
  const err = (k: string) =>
    state?.errors?.[k]?.map((m) => (
      <p key={m} className="mt-1 text-sm text-red-600">{m}</p>
    ));

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{isSignup ? "Criar conta" : "Entrar"}</h1>
      <form action={action} className="flex flex-col gap-3">
        {isSignup && (
          <label>Nome
            <input name="name" required className={field} />
            {err("name")}
          </label>
        )}
        <label>E-mail
          <input name="email" type="email" required className={field} />
          {err("email")}
        </label>
        <label>Senha
          <input name="password" type="password" required minLength={isSignup ? 8 : undefined} className={field} />
          {err("password")}
        </label>
        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
        <button disabled={pending} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
          {pending ? "Aguarde..." : isSignup ? "Cadastrar" : "Entrar"}
        </button>
      </form>
      <Link href={isSignup ? "/login" : "/cadastro"} className="text-sm text-blue-600 underline">
        {isSignup ? "Já tenho conta" : "Criar uma conta"}
      </Link>
    </main>
  );
}
