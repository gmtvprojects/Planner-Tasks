"use client";

import { useTransition } from "react";
import { dialog } from "@/app/dialogs";
import { deleteProject, renameProject } from "@/app/dashboard/actions";

export function ProjectActions({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-3 text-sm">
      <button
        disabled={pending}
        className="link"
        onClick={async () => {
          const n = await dialog.prompt({
            title: "Renomear projeto",
            defaultValue: name,
            confirmLabel: "Salvar",
          });
          if (n && n !== name) start(() => renameProject(id, n));
        }}
      >
        Renomear
      </button>
      <button
        disabled={pending}
        className="link-danger"
        onClick={async () => {
          const ok = await dialog.confirm({
            title: "Excluir projeto",
            message: `"${name}" será excluído com quadro, reuniões e associações. Esta ação não pode ser desfeita.`,
            danger: true,
          });
          if (ok) start(() => deleteProject(id));
        }}
      >
        Excluir
      </button>
    </div>
  );
}
