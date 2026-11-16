"use client";

import { useTransition } from "react";
import { deleteBoard, renameBoard } from "@/app/boards/actions";

export function BoardCardActions({ id, name, isOwner }: { id: string; name: string; isOwner: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="relative z-10 mt-2 flex w-fit gap-3 text-sm">
      <button
        disabled={pending}
        className="link"
        onClick={() => {
          const n = prompt("Novo nome do quadro", name)?.trim();
          if (n && n !== name) start(() => renameBoard(id, n));
        }}
      >
        Renomear
      </button>
      {isOwner && (
        <button
          disabled={pending}
          className="link-danger"
          onClick={() => {
            if (confirm(`Excluir o quadro "${name}" e todos os cartões?`)) start(() => deleteBoard(id));
          }}
        >
          Excluir
        </button>
      )}
    </div>
  );
}
