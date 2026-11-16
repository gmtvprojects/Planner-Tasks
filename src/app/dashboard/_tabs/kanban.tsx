"use client";

import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createColumn,
  createDraftCard,
  deleteColumn,
  moveCardToStatus,
  moveColumn,
  renameColumn,
} from "@/app/dashboard/actions";
import { dialog } from "@/app/dialogs";
import { Avatar, CardModal, LabelChip, type CardT, type LabelT } from "./card-modal";
import { FilterBar, type Filters, type Option } from "./filter-bar";

export type ColInfo = { id: string; projectId: string; title: string; position: number };
type ProjectT = { id: string; name: string };
type MemberOpt = { id: string; name: string; projectIds: string[] };
type LabelOpt = LabelT & { projectId: string };

/** Uma aba exibida: reúne as abas de mesmo nome de todos os projetos selecionados. */
type Group = { key: string; title: string; position: number; colIds: string[] };

const keyOf = (t: string) => t.trim().toLowerCase();
const groupDndId = (key: string) => `col:${key}`;
const cardDndId = (id: string) => `card:${id}`;
const raw = (id: string | number) => String(id).slice(String(id).indexOf(":") + 1);

/** Posição (Float) para inserir no índice `index` de uma lista já sem o item movido. */
function positionAt(items: { position: number }[], index: number) {
  const prev = items[index - 1]?.position;
  const next = items[index]?.position;
  if (prev === undefined && next === undefined) return 1024;
  if (prev === undefined) return next! / 2;
  if (next === undefined) return prev + 1024;
  return (prev + next) / 2;
}

async function persist<T>(p: Promise<T>) {
  try {
    return await p;
  } catch {
    await dialog.alert({ title: "Não foi possível salvar", message: "A página será recarregada." });
    window.location.reload();
    throw new Error("persist failed");
  }
}

export function Kanban({
  projects,
  columns: initialCols,
  cards: initialCards,
  members,
  labels,
}: {
  projects: ProjectT[];
  columns: ColInfo[];
  cards: CardT[];
  members: MemberOpt[];
  labels: LabelOpt[];
}) {
  const [cols, setCols] = useState<ColInfo[]>(initialCols);
  const [cards, setCards] = useState<CardT[]>(initialCards);
  const [filters, setFilters] = useState<Filters>({ projects: [], assignees: [], labels: [] });
  const [active, setActive] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ columnId: string; card: CardT } | null>(null);
  const [newCol, setNewCol] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ---------- Derivados ----------
  const colById = useMemo(() => new Map(cols.map((c) => [c.id, c])), [cols]);
  const selectedIds = useMemo(
    () => (filters.projects.length ? filters.projects : projects.map((p) => p.id)),
    [filters.projects, projects],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const cardKey = (c: CardT) => c.statusKey ?? keyOf(colById.get(c.columnId)?.title ?? "");

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const c of [...cols].sort((a, b) => a.position - b.position)) {
      if (!selectedSet.has(c.projectId)) continue;
      const k = keyOf(c.title);
      const g = map.get(k);
      if (g) {
        g.colIds.push(c.id);
        g.position = Math.min(g.position, c.position);
      } else map.set(k, { key: k, title: c.title, position: c.position, colIds: [c.id] });
    }
    return [...map.values()].sort((a, b) => a.position - b.position);
  }, [cols, selectedSet]);

  const passes = (c: CardT) => {
    if (!selectedSet.has(c.projectId)) return false;
    if (filters.assignees.length) {
      const ok = filters.assignees.some((a) =>
        a === "none" ? c.assignees.length === 0 : c.assignees.some((x) => x.id === a),
      );
      if (!ok) return false;
    }
    if (filters.labels.length && !c.labels.some((l) => filters.labels.includes(l.id))) return false;
    return true;
  };

  const visibleIn = (key: string) =>
    cards.filter((c) => cardKey(c) === key && passes(c)).sort((a, b) => a.position - b.position);

  const editing = editingId ? (cards.find((k) => k.id === editingId) ?? null) : null;

  // ---------- Opções dos filtros ----------
  const projectOptions: Option[] = projects.map((p) => ({ value: p.id, label: p.name, text: p.name }));
  const assigneeOptions: Option[] = [
    { value: "none", label: <i>Sem responsável</i>, text: "Sem responsável" },
    ...members
      .filter((m) => m.projectIds.some((id) => selectedSet.has(id)))
      .map((m) => ({
        value: m.id,
        text: m.name,
        label: (
          <span className="flex items-center gap-2">
            <Avatar name={m.name} />
            {m.name}
          </span>
        ),
      })),
  ];
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
  const labelOptions: Option[] = labels
    .filter((l) => selectedSet.has(l.projectId))
    .map((l) => ({
      value: l.id,
      text: l.name,
      label: <LabelChip label={l} />,
      hint: selectedIds.length > 1 ? projName(l.projectId) : undefined,
    }));

  // ---------- Arrastar e soltar ----------
  const collision: CollisionDetection = (args) => {
    if (String(args.active.id).startsWith("col:")) {
      return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith("col:")),
      });
    }
    return closestCorners(args);
  };

  function onDragStart(e: DragStartEvent) {
    setActive(String(e.active.id));
  }

  // Muda o cartão de aba enquanto arrasta (feedback imediato).
  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over || !String(a.id).startsWith("card:")) return;
    const aId = raw(a.id);
    const overRaw = raw(over.id);
    setCards((cs) => {
      const me = cs.find((c) => c.id === aId);
      if (!me) return cs;
      const targetKey = String(over.id).startsWith("card:")
        ? (() => {
            const o = cs.find((c) => c.id === overRaw);
            return o ? (o.statusKey ?? keyOf(colById.get(o.columnId)?.title ?? "")) : null;
          })()
        : overRaw;
      if (!targetKey || targetKey === (me.statusKey ?? keyOf(colById.get(me.columnId)?.title ?? ""))) return cs;
      return cs.map((c) => (c.id === aId ? { ...c, statusKey: targetKey } : c));
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const { active: a, over } = e;
    if (!over) {
      // Soltou fora: desfaz a mudança provisória.
      setCards((cs) => cs.map((c) => (c.statusKey ? { ...c, statusKey: undefined } : c)));
      return;
    }
    const aId = raw(a.id);

    // ----- aba (grupo) -----
    if (String(a.id).startsWith("col:")) {
      const overKey = String(over.id).startsWith("col:")
        ? raw(over.id)
        : (() => {
            const o = cards.find((c) => c.id === raw(over.id));
            return o ? cardKey(o) : null;
          })();
      if (!overKey || overKey === aId) return;
      const oldIdx = groups.findIndex((g) => g.key === aId);
      const newIdx = groups.findIndex((g) => g.key === overKey);
      if (oldIdx < 0 || newIdx < 0) return;
      const moved = arrayMove(groups, oldIdx, newIdx);
      const idx = moved.findIndex((g) => g.key === aId);
      const position = positionAt(
        moved.filter((g) => g.key !== aId),
        idx,
      );
      const ids = new Set(groups[oldIdx].colIds);
      setCols((cs) => cs.map((c) => (ids.has(c.id) ? { ...c, position } : c)));
      await persist(Promise.all([...ids].map((id) => moveColumn(id, position))));
      return;
    }

    // ----- cartão -----
    const card = cards.find((c) => c.id === aId);
    if (!card) return;
    const key = cardKey(card);
    const group = groups.find((g) => g.key === key);
    if (!group) return;
    let ordered = visibleIn(key);
    if (String(over.id).startsWith("card:")) {
      const from = ordered.findIndex((k) => k.id === aId);
      const to = ordered.findIndex((k) => k.id === raw(over.id));
      if (to >= 0 && from >= 0 && from !== to) ordered = arrayMove(ordered, from, to);
    }
    const index = ordered.findIndex((k) => k.id === aId);
    const position = positionAt(
      ordered.filter((k) => k.id !== aId),
      index,
    );
    setCards((cs) => cs.map((c) => (c.id === aId ? { ...c, position } : c)));

    const res = await persist(moveCardToStatus(aId, group.title, position));
    if (res.column) setCols((cs) => (cs.some((c) => c.id === res.column!.id) ? cs : [...cs, res.column!]));
    setCards((cs) => cs.map((c) => (c.id === aId ? { ...c, columnId: res.columnId, statusKey: undefined } : c)));
  }

  // ---------- Abas ----------
  async function addColumn() {
    const name = newCol.trim();
    if (!name) return;
    setNewCol("");
    const k = keyOf(name);
    const missing = selectedIds.filter((pid) => !cols.some((c) => c.projectId === pid && keyOf(c.title) === k));
    const created = await persist(
      Promise.all(missing.map(async (pid) => ({ ...(await createColumn(pid, name)), projectId: pid }))),
    );
    setCols((cs) => [...cs, ...created]);
  }

  async function renameGroup(g: Group) {
    const name = await dialog.prompt({ title: "Renomear aba", defaultValue: g.title, confirmLabel: "Salvar" });
    if (!name || name === g.title) return;
    const ids = new Set(g.colIds);
    setCols((cs) => cs.map((c) => (ids.has(c.id) ? { ...c, title: name } : c)));
    await persist(Promise.all([...ids].map((id) => renameColumn(id, name))));
  }

  async function removeGroup(g: Group) {
    const ids = new Set(g.colIds);
    const total = cards.filter((c) => ids.has(c.columnId)).length;
    const nProjects = new Set(g.colIds.map((id) => colById.get(id)?.projectId)).size;
    const ok = await dialog.confirm({
      title: "Excluir aba",
      message:
        (nProjects > 1 ? `A aba "${g.title}" será excluída de ${nProjects} projetos. ` : `A aba "${g.title}" será excluída. `) +
        (total ? `Os ${total} cartões dentro dela também serão excluídos. Esta ação não pode ser desfeita.` : ""),
      danger: true,
    });
    if (!ok) return;
    setCols((cs) => cs.filter((c) => !ids.has(c.id)));
    setCards((cs) => cs.filter((c) => !ids.has(c.columnId)));
    await persist(Promise.all([...ids].map((id) => deleteColumn(id))));
  }

  // ---------- Cartões ----------
  async function startCard(g: Group) {
    // Cria no primeiro projeto (ordem alfabética) selecionado que tem essa aba; o projeto pode ser trocado no formulário.
    const candidates = g.colIds
      .map((id) => colById.get(id)!)
      .sort((a, b) => projName(a.projectId).localeCompare(projName(b.projectId)));
    const col = candidates[0];
    const c = await persist(createDraftCard(col.id));
    setDraft({
      columnId: col.id,
      card: {
        id: c.id,
        title: c.title,
        description: c.description,
        position: c.position,
        labels: [],
        assignees: [],
        columnId: col.id,
        projectId: col.projectId,
        projectName: projName(col.projectId),
      },
    });
  }

  function finishDraft(needsReload: boolean) {
    const d = draft;
    setDraft(null);
    if (!d) return;
    if (needsReload) return window.location.reload();
    setCards((cs) => [...cs, d.card]);
  }

  function patchCard(id: string, patch: Partial<CardT>) {
    setCards((cs) => cs.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  }

  function dropCard(id: string) {
    setEditingId(null);
    setCards((cs) => cs.filter((k) => k.id !== id));
  }

  const activeCard = active?.startsWith("card:") ? cards.find((k) => k.id === raw(active)) : null;
  const activeGroup = active?.startsWith("col:") ? groups.find((g) => g.key === raw(active)) : null;
  const filtered = filters.assignees.length + filters.labels.length > 0;

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        projectOptions={projectOptions}
        assigneeOptions={assigneeOptions}
        labelOptions={labelOptions}
      />

      <DndContext
        id="kanban"
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActive(null);
          setCards((cs) => cs.map((c) => (c.statusKey ? { ...c, statusKey: undefined } : c)));
        }}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4">
          <SortableContext items={groups.map((g) => groupDndId(g.key))} strategy={horizontalListSortingStrategy}>
            {groups.map((g) => (
              <Column
                key={g.key}
                group={g}
                cards={visibleIn(g.key)}
                filtered={filtered}
                onRename={() => renameGroup(g)}
                onDelete={() => removeGroup(g)}
                onAddCard={() => startCard(g)}
                onEditCard={(k) => setEditingId(k.id)}
              />
            ))}
          </SortableContext>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addColumn();
            }}
            className="w-72 shrink-0 panel p-3"
          >
            <input
              value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              placeholder="+ Nova aba"
              className="field py-1"
            />
          </form>
        </div>

        <DragOverlay>
          {activeCard && <CardView card={activeCard} />}
          {activeGroup && (
            <div className="panel w-72 border-brand p-3 font-bold opacity-90">{activeGroup.title}</div>
          )}
        </DragOverlay>
      </DndContext>

      {draft && (
        <CardModal
          key={draft.card.id}
          isNew
          card={draft.card}
          projectName={draft.card.projectName}
          onClose={() => setDraft(null)}
          onChange={(patch) => setDraft((d) => d && { ...d, card: { ...d.card, ...patch } })}
          onMovedOut={() => setDraft(null)}
          onDeleted={() => setDraft(null)}
          onCreate={finishDraft}
          onDiscard={() => setDraft(null)}
        />
      )}

      {editing && (
        <CardModal
          key={editing.id}
          card={editing}
          projectName={editing.projectName}
          onClose={() => setEditingId(null)}
          onChange={(patch) => patchCard(editing.id, patch)}
          // Mudou de projeto: o cartão passa para outra aba/projeto, então recarrega o quadro.
          onMovedOut={() => window.location.reload()}
          onDeleted={() => dropCard(editing.id)}
        />
      )}
    </>
  );
}

function Column({
  group,
  cards,
  filtered,
  onRename,
  onDelete,
  onAddCard,
  onEditCard,
}: {
  group: Group;
  cards: CardT[];
  filtered: boolean;
  onRename: () => void;
  onDelete: () => void;
  onAddCard: () => void;
  onEditCard: (c: CardT) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupDndId(group.key),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex max-h-full w-72 shrink-0 flex-col panel p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex-1 cursor-grab font-bold" {...attributes} {...listeners}>
          {group.title} <span className="text-sm text-muted">{cards.length}</span>
        </h2>
        <button onClick={onRename} title="Renomear" className="text-sm">✎</button>
        <button onClick={onDelete} title="Excluir" className="text-sm text-danger">✕</button>
      </div>

      <SortableContext items={cards.map((k) => cardDndId(k.id))} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-8 flex-col gap-2 overflow-y-auto">
          {cards.map((k) => (
            <SortableCard key={k.id} card={k} onClick={() => onEditCard(k)} />
          ))}
          {cards.length === 0 && filtered && <p className="px-1 text-xs text-muted">Nenhum cartão com esses filtros.</p>}
        </div>
      </SortableContext>

      <div className="mt-3 flex justify-end">
        <button
          title="Adicionar cartão"
          aria-label="Adicionar cartão"
          className="flex size-8 items-center justify-center rounded-md border border-line text-lg font-bold leading-none text-muted transition hover:border-brand hover:bg-brand hover:text-brand-ink"
          onClick={onAddCard}
        >
          +
        </button>
      </div>
    </div>
  );
}

function CardView({ card }: { card: CardT }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-2 text-sm text-fg transition hover:border-brand">
      <div className="mb-1.5 flex flex-wrap gap-1">
        <span className="inline-block rounded border border-brand px-2 py-0.5 text-xs font-bold text-brand">
          {card.projectName}
        </span>
        {card.labels.map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
      </div>
      <p className="font-medium">{card.title}</p>
      {card.assignees.length > 0 && (
        <div className="mt-2 flex -space-x-1">
          {card.assignees.map((a) => (
            <Avatar key={a.id} name={a.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortableCard({ card, onClick }: { card: CardT; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="cursor-grab"
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <CardView card={card} />
    </div>
  );
}
