"use client";

import { useEffect, useRef, useState } from "react";
import { dialog } from "@/app/dialogs";
import { deleteCard, updateCard } from "@/app/dashboard/actions";
import {
  addChecklistItem,
  addComment,
  createLabel,
  deleteChecklistItem,
  deleteComment,
  deleteLabel,
  getCardDetail,
  moveCardToProject,
  setCardAssignees,
  setCardLabels,
  updateChecklistItem,
  type CardDetail,
} from "@/app/dashboard/card-actions";

export type LabelT = { id: string; name: string; color: string };
export type AssigneeT = { id: string; name: string };
export type CardT = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  labels: LabelT[];
  assignees: AssigneeT[];
};

export const LABEL_COLORS = ["#8fff00", "#ffd93d", "#ff9f43", "#ff6b6b", "#ff8ad8", "#b69cff", "#6cb6ff", "#4fe3c1"];

export function LabelChip({ label }: { label: LabelT }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-bold"
      style={{ background: label.color, color: "#0d0d0d" }}
    >
      {label.name}
    </span>
  );
}

async function run<T>(p: Promise<T>): Promise<T | undefined> {
  try {
    return await p;
  } catch {
    await dialog.alert({ title: "Não foi possível salvar", message: "Tente novamente em instantes." });
    return undefined;
  }
}

/** Para ações sem retorno: true se deu certo. */
async function attempt(p: Promise<unknown>): Promise<boolean> {
  return (await run(p.then(() => true))) === true;
}

export function CardModal({
  card,
  isNew = false,
  projectName,
  onClose,
  onChange,
  onMovedOut,
  onDeleted,
  onCreate,
  onDiscard,
}: {
  card: CardT;
  /** Modo criação: o cartão é um rascunho até confirmar com "Criar cartão". */
  isNew?: boolean;
  projectName: string;
  onClose: () => void;
  onChange: (patch: Partial<CardT>) => void;
  onMovedOut: () => void;
  onDeleted: () => void;
  /** needsReload: o projeto foi trocado durante a criação, então o quadro precisa recarregar. */
  onCreate?: (needsReload: boolean) => void;
  onDiscard?: () => void;
}) {
  const [d, setD] = useState<CardDetail | null>(null);
  const [side, setSide] = useState<"info" | "history">("info");
  const projectTouched = useRef(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [newItem, setNewItem] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);
  const [comment, setComment] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [editingItem, setEditingItem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCardDetail(card.id).then((x) => alive && setD(x)).catch(() => {
      onClose();
      dialog.alert({ title: "Não foi possível carregar o cartão" });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const titleInvalid = !title.trim();

  async function saveText(): Promise<boolean> {
    if (titleInvalid) return false;
    if (title.trim() === card.title && description.trim() === (card.description ?? "")) return true;
    if (await attempt(updateCard(card.id, { title: title.trim(), description }))) {
      onChange({ title: title.trim(), description: description.trim() || null });
      return true;
    }
    return false;
  }

  /** Confirma a criação (exige título). */
  async function finishCreate() {
    if (titleInvalid || !d) return;
    if (await saveText()) onCreate?.(projectTouched.current);
  }

  /** Fechar: em edição só fecha; na criação confirma se há título, senão descarta o rascunho. */
  async function requestClose() {
    if (!isNew) return onClose();
    if (titleInvalid) {
      await attempt(deleteCard(card.id));
      return onDiscard?.();
    }
    await finishCreate();
  }

  async function cancelCreate() {
    await attempt(deleteCard(card.id));
    onDiscard?.();
  }

  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) closeRef.current();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ----- etiquetas -----
  async function applyLabels(ids: string[], labels = d!.projectLabels) {
    setD((x) => x && { ...x, labelIds: ids, projectLabels: labels });
    onChange({ labels: labels.filter((l) => ids.includes(l.id)) });
    await run(setCardLabels(card.id, ids));
  }
  async function addLabel() {
    if (!d || !labelName.trim()) return;
    const l = await run(createLabel(d.projectId, labelName, labelColor));
    if (!l) return;
    setLabelName("");
    await applyLabels([...d.labelIds, l.id], [...d.projectLabels, l]);
  }
  async function removeLabel(id: string) {
    if (!d) return;
    const ok = await dialog.confirm({
      title: "Excluir etiqueta",
      message: "A etiqueta será removida de todos os cartões do projeto.",
      danger: true,
    });
    if (!ok) return;
    await run(deleteLabel(id));
    const labels = d.projectLabels.filter((l) => l.id !== id);
    const ids = d.labelIds.filter((x) => x !== id);
    setD({ ...d, projectLabels: labels, labelIds: ids });
    onChange({ labels: labels.filter((l) => ids.includes(l.id)) });
  }

  // ----- responsáveis -----
  async function applyAssignees(ids: string[]) {
    if (!d) return;
    setD({ ...d, assigneeIds: ids });
    onChange({ assignees: d.members.filter((m) => ids.includes(m.id)) });
    await run(setCardAssignees(card.id, ids));
  }

  // ----- projeto -----
  async function changeProject(projectId: string) {
    if (!d || projectId === d.projectId) return;
    const loses = d.labelIds.length > 0 || d.assigneeIds.length > 0;
    const target = d.projects.find((p) => p.id === projectId)?.name;
    if (loses || !isNew) {
      const ok = await dialog.confirm({
        title: isNew ? "Trocar projeto" : "Mover cartão",
        message: `O cartão ${isNew ? "ficará" : "irá"} na primeira aba de "${target}".${loses ? " As etiquetas serão removidas e só os responsáveis que são membros do novo projeto serão mantidos." : ""}`,
        confirmLabel: isNew ? "Trocar" : "Mover",
      });
      if (!ok) return;
    }
    if (!(await attempt(moveCardToProject(card.id, projectId)))) return;
    if (!isNew) return onMovedOut();
    // Criação: continua no modal, agora com os dados do novo projeto.
    projectTouched.current = true;
    const fresh = await run(getCardDetail(card.id));
    if (!fresh) return;
    setD(fresh);
    onChange({
      labels: [],
      assignees: fresh.members.filter((m) => fresh.assigneeIds.includes(m.id)),
    });
  }

  // ----- checklist -----
  async function addItem() {
    const t = newItem.trim();
    if (!t || !d) return;
    setNewItem("");
    const i = await run(addChecklistItem(card.id, t));
    if (i) setD((x) => x && { ...x, checklist: [...x.checklist, i] });
  }
  async function toggleItem(id: string, done: boolean) {
    setD((x) => x && { ...x, checklist: x.checklist.map((i) => (i.id === id ? { ...i, done } : i)) });
    await run(updateChecklistItem(id, { done }));
  }
  async function renameItem(id: string, text: string) {
    setEditingItem(null);
    const t = text.trim();
    if (!t) return;
    setD((x) => x && { ...x, checklist: x.checklist.map((i) => (i.id === id ? { ...i, text: t } : i)) });
    await run(updateChecklistItem(id, { text: t }));
  }
  async function removeItem(id: string) {
    setD((x) => x && { ...x, checklist: x.checklist.filter((i) => i.id !== id) });
    await run(deleteChecklistItem(id));
  }

  // ----- comentários -----
  async function sendComment() {
    const b = comment.trim();
    if (!b) return;
    setComment("");
    const c = await run(addComment(card.id, b));
    if (c) setD((x) => x && { ...x, comments: [...x.comments, c] });
  }
  async function removeComment(id: string) {
    setD((x) => x && { ...x, comments: x.comments.filter((c) => c.id !== id) });
    await run(deleteComment(id));
  }

  const done = d?.checklist.filter((i) => i.done).length ?? 0;
  const total = d?.checklist.length ?? 0;
  const assigned = d ? d.members.filter((m) => d.assigneeIds.includes(m.id)) : [];
  const available = d ? d.members.filter((m) => !d.assigneeIds.includes(m.id)) : [];
  const h = "mb-2 text-xs font-bold uppercase tracking-widest text-muted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={() => requestClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel my-8 grid w-full max-w-4xl gap-6 p-5 md:grid-cols-[1fr_16rem]"
      >
        {/* ===== Coluna esquerda ===== */}
        <div className="min-w-0 space-y-6">
          {isNew && <h2 className="text-xl font-black text-brand">Novo cartão</h2>}
          <div>
            <p className={h}>Título *</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveText}
              maxLength={200}
              autoFocus={isNew}
              placeholder={isNew ? "Dê um título ao cartão" : undefined}
              className={`field text-lg font-bold ${titleInvalid && !isNew ? "border-danger" : ""}`}
            />
            {titleInvalid && !isNew && <p className="mt-1 text-sm text-danger">O título é obrigatório.</p>}
          </div>

          <div>
            <p className={h}>Descrição</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveText}
              rows={4}
              placeholder="Adicione uma descrição (opcional)"
              className="field"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between">
              <p className={h}>Checklist {total > 0 && <span className="text-brand">{done}/{total}</span>}</p>
              {total === 0 && !showChecklist && (
                <button className="link mb-2 text-sm" onClick={() => setShowChecklist(true)}>
                  + Incluir checklist
                </button>
              )}
            </div>
            {total > 0 && (
              <div className="mb-2 h-1.5 overflow-hidden rounded bg-surface-2">
                <div className="h-full bg-brand transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            )}
            {(total > 0 || showChecklist) && (
              <>
                <ul className="space-y-1">
                  {d?.checklist.map((i) => (
                    <li key={i.id} className="group flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={i.done}
                        onChange={(e) => toggleItem(i.id, e.target.checked)}
                        className="size-4 accent-[#8fff00]"
                      />
                      {editingItem === i.id ? (
                        <input
                          autoFocus
                          defaultValue={i.text}
                          className="field py-0.5 text-sm"
                          onBlur={(e) => renameItem(i.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingItem(null);
                          }}
                        />
                      ) : (
                        <button
                          className={`flex-1 text-left text-sm ${i.done ? "text-muted line-through" : ""}`}
                          onClick={() => setEditingItem(i.id)}
                          title="Clique para editar"
                        >
                          {i.text}
                        </button>
                      )}
                      <button
                        className="text-sm text-danger opacity-0 transition group-hover:opacity-100"
                        onClick={() => removeItem(i.id)}
                        title="Remover item"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addItem();
                  }}
                >
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="+ Adicionar item"
                    className="field py-1 text-sm"
                  />
                </form>
              </>
            )}
          </div>

          {/* Comentários */}
          <div>
            <p className={h}>Comentários</p>
            <form
              className="mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendComment();
              }}
            >
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment();
                }}
                rows={2}
                placeholder="Escreva um comentário (Ctrl+Enter envia)"
                className="field"
              />
              {comment.trim() && <button className="btn-primary mt-2 py-1 text-sm">Comentar</button>}
            </form>
            <ul className="space-y-3">
              {[...(d?.comments ?? [])].reverse().map((c) => (
                <li key={c.id} className="rounded-md bg-surface-2 p-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      <b className="text-fg">{c.authorName}</b> ·{" "}
                      <span suppressHydrationWarning>
                        {new Date(c.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </span>
                    {d && (c.authorId === d.userId || d.canManage) && (
                      <button className="link-danger" onClick={() => removeComment(c.id)}>
                        Excluir
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          </div>

          {isNew && (
            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <button type="button" className="link text-sm" onClick={cancelCreate}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={titleInvalid || !d}
                title={titleInvalid ? "Informe o título" : undefined}
                onClick={finishCreate}
              >
                Criar cartão
              </button>
            </div>
          )}
        </div>

        {/* ===== Coluna direita ===== */}
        <aside className="space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-line">
            <div className="flex gap-1">
              {(["info", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSide(t)}
                  className={`-mb-px border-b-2 px-2 py-1.5 text-sm font-bold transition ${
                    side === t ? "border-brand text-brand" : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  {t === "info" ? "Informações" : "Histórico"}
                </button>
              ))}
            </div>
            <button onClick={() => requestClose()} className="link text-sm" title="Fechar (Esc)">
              ✕
            </button>
          </div>

          {side === "history" && (
            <ul className="space-y-3">
              {d?.events.length === 0 && <li className="text-sm text-muted">Sem movimentações.</li>}
              {d?.events.map((e) => (
                <li key={e.id} className="border-l-2 border-brand pl-3 text-sm">
                  <p>
                    <b>{e.userName ?? "Alguém"}</b>{" "}
                    {e.fromTitle === null ? (
                      <>
                        criou o cartão em <b className="text-brand">{e.toTitle}</b>
                      </>
                    ) : (
                      <>
                        moveu de <b>{e.fromTitle}</b> para <b className="text-brand">{e.toTitle}</b>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted" suppressHydrationWarning>
                    {new Date(e.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {side === "info" && (
          <>
          <div>
            <p className={h}>Criado em</p>
            <p className="text-sm" suppressHydrationWarning>
              {d ? new Date(d.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }) : "—"}
            </p>
          </div>

          <div>
            <p className={h}>Projeto *</p>
            <select
              value={d?.projectId ?? ""}
              onChange={(e) => changeProject(e.target.value)}
              disabled={!d}
              className="field text-sm"
            >
              {!d && <option value="">{projectName}</option>}
              {d?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className={h}>Responsáveis</p>
            <div className="flex flex-wrap gap-1.5">
              {assigned.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-1 pr-2 text-sm">
                  <Avatar name={m.name} />
                  {m.name}
                  <button
                    className="text-muted hover:text-danger"
                    onClick={() => applyAssignees(d!.assigneeIds.filter((x) => x !== m.id))}
                    title="Remover responsável"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button
                className="rounded-full border border-dashed border-line px-2 text-sm text-muted hover:border-brand hover:text-brand"
                onClick={() => setAssigneesOpen((o) => !o)}
                disabled={!d}
              >
                + Adicionar
              </button>
            </div>
            {assigneesOpen && d && (
              <select
                autoFocus
                className="field mt-2 text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) applyAssignees([...d.assigneeIds, e.target.value]);
                  setAssigneesOpen(false);
                }}
                onBlur={() => setAssigneesOpen(false)}
              >
                <option value="">
                  {available.length ? "Selecione um membro..." : "Todos os membros já foram adicionados"}
                </option>
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <p className={h}>Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {d?.projectLabels
                .filter((l) => d.labelIds.includes(l.id))
                .map((l) => (
                  <LabelChip key={l.id} label={l} />
                ))}
              <button
                className="rounded border border-dashed border-line px-2 text-sm text-muted hover:border-brand hover:text-brand"
                onClick={() => setLabelsOpen((o) => !o)}
                disabled={!d}
              >
                {labelsOpen ? "Fechar" : "+ Etiquetas"}
              </button>
            </div>
            {labelsOpen && d && (
              <div className="mt-2 space-y-2 rounded-md border border-line p-2">
                {d.projectLabels.length === 0 && <p className="text-xs text-muted">Nenhuma etiqueta criada ainda.</p>}
                <ul className="space-y-1">
                  {d.projectLabels.map((l) => {
                    const on = d.labelIds.includes(l.id);
                    return (
                      <li key={l.id} className="flex items-center gap-2">
                        <button
                          onClick={() => applyLabels(on ? d.labelIds.filter((x) => x !== l.id) : [...d.labelIds, l.id])}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          <span className={`size-4 rounded-sm border ${on ? "border-brand bg-brand" : "border-line"}`} />
                          <LabelChip label={l} />
                        </button>
                        <button className="text-xs text-muted hover:text-danger" onClick={() => removeLabel(l.id)} title="Excluir etiqueta">
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <form
                  className="space-y-2 border-t border-line pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addLabel();
                  }}
                >
                  <input
                    value={labelName}
                    onChange={(e) => setLabelName(e.target.value)}
                    placeholder="Nova etiqueta"
                    maxLength={40}
                    className="field py-1 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {LABEL_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setLabelColor(c)}
                        className={`size-6 rounded-full border-2 ${labelColor === c ? "border-white" : "border-transparent"}`}
                        style={{ background: c }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                  <button className="btn-primary w-full py-1 text-sm" disabled={!labelName.trim()}>
                    Criar etiqueta
                  </button>
                </form>
              </div>
            )}
          </div>

          {!isNew && (
            <div className="border-t border-line pt-4">
              <button
                className="link-danger text-sm"
                onClick={async () => {
                  const ok = await dialog.confirm({
                    title: "Excluir cartão",
                    message: `"${card.title}" será excluído com checklist e comentários.`,
                    danger: true,
                  });
                  if (!ok) return;
                  if (await attempt(deleteCard(card.id))) onDeleted();
                }}
              >
                Excluir cartão
              </button>
            </div>
          )}
          </>
          )}
        </aside>
      </div>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-black text-brand-ink"
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
