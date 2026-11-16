"use client";

import { useTransition } from "react";
import { deleteProject, renameProject } from "@/app/dashboard/actions";

export function ProjectActions({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-3 text-sm">
      <button
        disabled={pending}
        className="link"
        onClick={() => {
          const n = prompt("Novo nome do projeto", name)?.trim();
          if (n && n !== name) start(() => renameProject(id, n));
        }}
      >
        Renomear
      </button>
      <button
        disabled={pending}
        className="link-danger"
        onClick={() => {
          if (confirm(`Excluir o projeto "${name}" com quadro, reuniões e associações?`)) {
            start(() => deleteProject(id));
          }
        }}
      >
        Excluir
      </button>
    </div>
  );
}
