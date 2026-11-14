"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState(isSignup ? signup : login, undefined);
  const err = (k: string) =>
    state?.errors?.[k]?.map((m) => (
      <p key={m} className="mt-1 text-sm text-danger">{m}</p>
    ));

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <p className="eyebrow">Planner <span className="text-muted">| Tasks</span></p>
        <h1 className="mt-2 text-4xl font-black leading-tight">
          {isSignup ? "Criar " : "Entrar "}
          <span className="text-brand">{isSignup ? "conta" : "no quadro"}</span>
        </h1>
      </div>
      <form action={action} className="flex flex-col gap-3 text-sm font-medium">
        {isSignup && (
          <label>Nome
            <input name="name" required className="field mt-1" />
            {err("name")}
          </label>
        )}
        <label>E-mail
          <input name="email" type="email" required className="field mt-1" />
          {err("email")}
        </label>
        <label>Senha
          <input name="password" type="password" required minLength={isSignup ? 8 : undefined} className="field mt-1" />
          {err("password")}
        </label>
        {state?.message && <p className="text-sm text-danger">{state.message}</p>}
        <button disabled={pending} className="btn-primary mt-1">
          {pending ? "Aguarde..." : isSignup ? "Cadastrar" : "Entrar"}
        </button>
      </form>
      <Link href={isSignup ? "/login" : "/cadastro"} className="link text-sm">
        {isSignup ? "Já tenho conta" : "Criar uma conta"}
      </Link>
    </main>
  );
}
