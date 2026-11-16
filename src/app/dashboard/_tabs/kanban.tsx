"use client";

import { useState } from "react";
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
  createCard,
  createColumn,
  deleteColumn,
  moveCard,
  moveColumn,
  renameColumn,
} from "@/app/dashboard/actions";
import { Avatar, CardModal, LabelChip, type CardT } from "./card-modal";

type ColumnT = { id: string; title: string; position: number; cards: CardT[] };

const colId = (id: string) => `col:${id}`;
const cardId = (id: string) => `card:${id}`;
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
    alert("Não foi possível salvar. A página será recarregada.");
    window.location.reload();
    throw new Error("persist failed");
  }
}

export function Kanban({
  projectId,
  projectName,
  initial,
}: {
  projectId: string;
  projectName: string;
  initial: ColumnT[];
}) {
  const [columns, setColumns] = useState<ColumnT[]>(initial);
  const [active, setActive] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? columns.flatMap((c) => c.cards).find((k) => k.id === editingId) ?? null : null;
  const [newCol, setNewCol] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Ao arrastar uma coluna, só colunas contam como alvo.
  const collision: CollisionDetection = (args) => {
    if (String(args.active.id).startsWith("col:")) {
      return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith("col:")),
      });
    }
    return closestCorners(args);
  };

  const findColByCard = (cols: ColumnT[], id: string) => cols.find((c) => c.cards.some((k) => k.id === id));

  function onDragStart(e: DragStartEvent) {
    setActive(String(e.active.id));
  }

  // Move o cartão de coluna enquanto arrasta (feedback visual imediato).
  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over || !String(a.id).startsWith("card:")) return;
    const aId = raw(a.id);
    const overIsCard = String(over.id).startsWith("card:");
    const overRaw = raw(over.id);

    setColumns((cols) => {
      const from = findColByCard(cols, aId);
      const to = overIsCard ? findColByCard(cols, overRaw) : cols.find((c) => c.id === overRaw);
      if (!from || !to || from.id === to.id) return cols;
      const card = from.cards.find((k) => k.id === aId)!;
      const idx = overIsCard ? to.cards.findIndex((k) => k.id === overRaw) : to.cards.length;
      return cols.map((c) => {
        if (c.id === from.id) return { ...c, cards: c.cards.filter((k) => k.id !== aId) };
        if (c.id === to.id) {
          const cards = [...c.cards];
          cards.splice(idx < 0 ? cards.length : idx, 0, card);
          return { ...c, cards };
        }
        return c;
      });
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const aId = raw(a.id);

    if (String(a.id).startsWith("col:")) {
      const overCol = String(over.id).startsWith("col:")
        ? raw(over.id)
        : findColByCard(columns, raw(over.id))?.id;
      if (!overCol || overCol === aId) return;
      const oldIdx = columns.findIndex((c) => c.id === aId);
      const newIdx = columns.findIndex((c) => c.id === overCol);
      const moved = arrayMove(columns, oldIdx, newIdx);
      const position = positionAt(
        moved.filter((c) => c.id !== aId),
        moved.findIndex((c) => c.id === aId),
      );
      setColumns(moved.map((c) => (c.id === aId ? { ...c, position } : c)));
      await persist(moveColumn(aId, position));
      return;
    }

    // Cartão: a coluna de destino já foi ajustada no onDragOver.
    const col = findColByCard(columns, aId);
    if (!col) return;
    let cards = col.cards;
    if (String(over.id).startsWith("card:")) {
      const from = cards.findIndex((k) => k.id === aId);
      const to = cards.findIndex((k) => k.id === raw(over.id));
      if (to >= 0 && from !== to) cards = arrayMove(cards, from, to);
    }
    const index = cards.findIndex((k) => k.id === aId);
    const position = positionAt(
      cards.filter((k) => k.id !== aId),
      index,
    );
    setColumns((cs) =>
      cs.map((c) =>
        c.id === col.id ? { ...c, cards: cards.map((k) => (k.id === aId ? { ...k, position } : k)) } : c,
      ),
    );
    await persist(moveCard(aId, col.id, position));
  }

  async function addColumn() {
    const name = newCol.trim();
    if (!name) return;
    setNewCol("");
    const c = await persist(createColumn(projectId, name));
    setColumns((cs) => [...cs, { ...c, cards: [] }]);
  }

  async function addCard(columnId: string, name: string) {
    const card = await persist(createCard(columnId, name));
    const full: CardT = { ...card, labels: [], assignees: [] };
    setColumns((cs) => cs.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, full] } : c)));
  }

  async function renameCol(c: ColumnT) {
    const name = prompt("Novo nome da aba", c.title)?.trim();
    if (!name || name === c.title) return;
    setColumns((cs) => cs.map((x) => (x.id === c.id ? { ...x, title: name } : x)));
    await persist(renameColumn(c.id, name));
  }

  async function removeCol(c: ColumnT) {
    const msg = c.cards.length
      ? `Excluir a aba "${c.title}" e seus ${c.cards.length} cartões?`
      : `Excluir a aba "${c.title}"?`;
    if (!confirm(msg)) return;
    setColumns((cs) => cs.filter((x) => x.id !== c.id));
    await persist(deleteColumn(c.id));
  }

  function patchCard(id: string, patch: Partial<CardT>) {
    setColumns((cs) => cs.map((c) => ({ ...c, cards: c.cards.map((k) => (k.id === id ? { ...k, ...patch } : k)) })));
  }

  function dropCard(id: string) {
    setEditingId(null);
    setColumns((cs) => cs.map((c) => ({ ...c, cards: c.cards.filter((k) => k.id !== id) })));
  }

  const activeCard = active?.startsWith("card:")
    ? columns.flatMap((c) => c.cards).find((k) => k.id === raw(active))
    : null;
  const activeColumn = active?.startsWith("col:") ? columns.find((c) => c.id === raw(active)) : null;

  return (
    <>
      <DndContext
        id="kanban"
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4">
          <SortableContext items={columns.map((c) => colId(c.id))} strategy={horizontalListSortingStrategy}>
            {columns.map((c) => (
              <Column
                key={c.id}
                column={c}
                onRename={() => renameCol(c)}
                onDelete={() => removeCol(c)}
                onAddCard={(t) => addCard(c.id, t)}
                projectName={projectName}
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
          {activeCard && <CardView card={activeCard} projectName={projectName} />}
          {activeColumn && (
            <div className="panel w-72 border-brand p-3 font-bold opacity-90">
              {activeColumn.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editing && (
        <CardModal
          key={editing.id}
          card={editing}
          projectName={projectName}
          onClose={() => setEditingId(null)}
          onChange={(patch) => patchCard(editing.id, patch)}
          onMovedOut={() => dropCard(editing.id)}
          onDeleted={() => dropCard(editing.id)}
        />
      )}
    </>
  );
}

function Column({
  column,
  onRename,
  onDelete,
  onAddCard,
  onEditCard,
  projectName,
}: {
  column: ColumnT;
  onRename: () => void;
  onDelete: () => void;
  onAddCard: (title: string) => void;
  onEditCard: (c: CardT) => void;
  projectName: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colId(column.id),
  });
  const [text, setText] = useState("");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex max-h-full w-72 shrink-0 flex-col panel p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex-1 cursor-grab font-bold" {...attributes} {...listeners}>
          {column.title} <span className="text-sm text-muted">{column.cards.length}</span>
        </h2>
        <button onClick={onRename} title="Renomear" className="text-sm">✎</button>
        <button onClick={onDelete} title="Excluir" className="text-sm text-danger">✕</button>
      </div>

      <SortableContext items={column.cards.map((k) => cardId(k.id))} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-8 flex-col gap-2 overflow-y-auto">
          {column.cards.map((k) => (
            <SortableCard key={k.id} card={k} projectName={projectName} onClick={() => onEditCard(k)} />
          ))}
        </div>
      </SortableContext>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          onAddCard(t);
        }}
        className="mt-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="+ Adicionar cartão"
          className="field py-1 text-sm"
        />
      </form>
    </div>
  );
}

function CardView({ card, projectName }: { card: CardT; projectName: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-2 text-sm text-fg transition hover:border-brand">
      <div className="mb-1.5 flex flex-wrap gap-1">
        <span className="inline-block rounded border border-brand px-2 py-0.5 text-xs font-bold text-brand">
          {projectName}
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

function SortableCard({
  card,
  projectName,
  onClick,
}: {
  card: CardT;
  projectName: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardId(card.id),
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
      <CardView card={card} projectName={projectName} />
    </div>
  );
}
