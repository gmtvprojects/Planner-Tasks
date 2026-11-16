"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type Option = { value: string; label: ReactNode; text: string; hint?: string };

function MultiFilter({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const valid = selected.filter((s) => options.some((o) => o.value === s));
  const summary =
    valid.length === 0
      ? "Todos"
      : valid.length === 1
        ? options.find((o) => o.value === valid[0])!.text
        : `${valid.length} selecionados`;

  const row = "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md border bg-surface-2 px-3 py-1.5 text-sm transition ${
          valid.length ? "border-brand" : "border-line"
        }`}
      >
        <span className="text-xs font-bold uppercase tracking-widest text-muted">{title}</span>
        <span className="max-w-40 truncate font-bold">{summary}</span>
        <span className="text-xs text-muted">▾</span>
      </button>

      {open && (
        <div className="panel absolute left-0 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto p-1 shadow-xl">
          <label className={row}>
            <input
              type="checkbox"
              className="size-4 accent-[#8fff00]"
              checked={valid.length === 0}
              onChange={() => onChange([])}
            />
            <span className="font-bold">Todos</span>
          </label>
          {options.map((o) => (
            <label key={o.value} className={row}>
              <input
                type="checkbox"
                className="size-4 accent-[#8fff00]"
                checked={valid.includes(o.value)}
                onChange={() =>
                  onChange(valid.includes(o.value) ? valid.filter((v) => v !== o.value) : [...valid, o.value])
                }
              />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.hint && <span className="truncate text-xs text-muted">{o.hint}</span>}
            </label>
          ))}
          {options.length === 0 && <p className="px-2 py-1.5 text-sm text-muted">Nada por aqui ainda.</p>}
        </div>
      )}
    </div>
  );
}

export type Filters = { projects: string[]; assignees: string[]; labels: string[] };

export function FilterBar({
  filters,
  onChange,
  projectOptions,
  assigneeOptions,
  labelOptions,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  projectOptions: Option[];
  assigneeOptions: Option[];
  labelOptions: Option[];
}) {
  const active = filters.projects.length + filters.assignees.length + filters.labels.length > 0;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <MultiFilter
        title="Projeto"
        options={projectOptions}
        selected={filters.projects}
        onChange={(projects) => onChange({ ...filters, projects })}
      />
      <MultiFilter
        title="Responsável"
        options={assigneeOptions}
        selected={filters.assignees}
        onChange={(assignees) => onChange({ ...filters, assignees })}
      />
      <MultiFilter
        title="Etiqueta"
        options={labelOptions}
        selected={filters.labels}
        onChange={(labels) => onChange({ ...filters, labels })}
      />
      {active && (
        <button className="link text-sm" onClick={() => onChange({ projects: [], assignees: [], labels: [] })}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
