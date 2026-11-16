"use client";

import { useState, useTransition } from "react";
import { dialog } from "@/app/dialogs";
import { addMember, removeMember, setMemberRole } from "@/app/dashboard/actions";

export type MemberT = {
  userId: string;
  name: string;
  email: string;
  role: "LEAD" | "MEMBER";
};

export function MembersList({
  projectId,
  members,
  canManage,
  currentUserId,
}: {
  projectId: string;
  members: MemberT[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [pending, start] = useTransition();

  if (members.length === 0) return <p className="text-sm text-muted">Nenhum membro ainda.</p>;

  return (
    <ul className="divide-y divide-line">
      {members.map((m) => (
        <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">
              {m.name}
              {m.userId === currentUserId && <span className="ml-2 text-xs text-muted">(você)</span>}
            </p>
            <p className="truncate text-sm text-muted">{m.email}</p>
          </div>
          {canManage ? (
            <>
              <select
                value={m.role}
                disabled={pending}
                onChange={(e) =>
                  start(() => setMemberRole(projectId, m.userId, e.target.value as "LEAD" | "MEMBER"))
                }
                className="field w-auto py-1 text-sm"
              >
                <option value="MEMBER">Membro</option>
                <option value="LEAD">Líder</option>
              </select>
              <button
                disabled={pending}
                className="link-danger text-sm"
                onClick={async () => {
                  const ok = await dialog.confirm({
                    title: "Remover membro",
                    message: `${m.name} deixará de ter acesso a este projeto.`,
                    confirmLabel: "Remover",
                    danger: true,
                  });
                  if (ok) start(() => removeMember(projectId, m.userId));
                }}
              >
                Remover
              </button>
            </>
          ) : (
            <span className="text-sm text-muted">{m.role === "LEAD" ? "Líder" : "Membro"}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AddMember({ projectId, suggestions }: { projectId: string; suggestions?: string[] }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listId = `emails-${projectId}`;

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        start(async () => {
          const res = await addMember(projectId, email);
          if (res.error) setError(res.error);
          else {
            setError(null);
            setEmail("");
          }
        });
      }}
    >
      <div className="flex gap-2">
        <input
          type="email"
          list={suggestions ? listId : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do usuário para adicionar"
          className="field py-1 text-sm"
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <button disabled={pending} className="btn-primary py-1 text-sm">Adicionar</button>
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </form>
  );
}
