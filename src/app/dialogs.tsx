"use client";

import { useEffect, useRef, useState } from "react";

type Opts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
};

type Active =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & Opts)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & Opts)
  | ({ kind: "alert"; resolve: () => void } & Opts);

let show: ((a: Active) => void) | null = null;

/** Diálogos dentro do sistema (substituem confirm/prompt/alert do navegador). */
export const dialog = {
  confirm: (o: Opts) =>
    new Promise<boolean>((resolve) => {
      if (show) show({ kind: "confirm", resolve, ...o });
      else resolve(false);
    }),
  prompt: (o: Opts) =>
    new Promise<string | null>((resolve) => {
      if (show) show({ kind: "prompt", resolve, ...o });
      else resolve(null);
    }),
  alert: (o: Opts) =>
    new Promise<void>((resolve) => {
      if (show) show({ kind: "alert", resolve, ...o });
      else resolve();
    }),
};

export function DialogHost() {
  const [queue, setQueue] = useState<Active[]>([]);

  useEffect(() => {
    show = (a) => setQueue((q) => [...q, a]);
    return () => {
      show = null;
    };
  }, []);

  const active = queue[0];
  if (!active) return null;
  return <DialogBody key={queue.length + active.title} active={active} onDone={() => setQueue((q) => q.slice(1))} />;
}

function DialogBody({ active, onDone }: { active: Active; onDone: () => void }) {
  const [value, setValue] = useState(active.kind === "prompt" ? (active.defaultValue ?? "") : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function close(ok: boolean) {
    if (active.kind === "confirm") active.resolve(ok);
    else if (active.kind === "prompt") active.resolve(ok && value.trim() ? value.trim() : null);
    else active.resolve();
    onDone();
  }

  const confirmLabel = active.confirmLabel ?? (active.kind === "alert" ? "OK" : active.danger ? "Excluir" : "Confirmar");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={() => close(false)}
      onKeyDown={(e) => e.key === "Escape" && close(false)}
    >
      <form
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (active.kind === "prompt" && !value.trim()) return;
          close(true);
        }}
        className="panel w-full max-w-sm space-y-4 p-5"
      >
        <h2 className="text-lg font-extrabold">{active.title}</h2>
        {active.message && <p className="text-sm text-muted">{active.message}</p>}
        {active.kind === "prompt" && (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={active.placeholder}
            maxLength={200}
            className="field"
          />
        )}
        <div className="flex justify-end gap-3">
          {active.kind !== "alert" && (
            <button type="button" className="link text-sm" onClick={() => close(false)}>
              Cancelar
            </button>
          )}
          <button
            autoFocus={active.kind !== "prompt"}
            className={
              active.danger
                ? "rounded-md bg-danger px-4 py-2 font-bold text-brand-ink hover:brightness-110"
                : "btn-primary"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
