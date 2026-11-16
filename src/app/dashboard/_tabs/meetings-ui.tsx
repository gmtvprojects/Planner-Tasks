"use client";

import { useState, useTransition } from "react";
import { dialog } from "@/app/dialogs";
import { createMeeting, deleteMeeting, updateMeeting, type MeetingInput } from "@/app/dashboard/actions";

export type MeetingT = {
  id: string;
  title: string;
  date: string; // ISO
  notes: string | null;
  createdById: string | null;
  attendees: { id: string; name: string }[];
};
type MemberOpt = { userId: string; name: string };

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingForm({
  initial,
  members,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: MeetingT;
  members: MemberOpt[];
  submitLabel: string;
  onSubmit: (input: MeetingInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(() => toLocalInput(initial?.date));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ids, setIds] = useState<string[]>(initial?.attendees.map((a) => a.id) ?? []);
  const [pending, start] = useTransition();

  return (
    <form
      className="panel flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !date) return;
        start(async () => {
          await onSubmit({ title, date: new Date(date).toISOString(), notes, attendeeIds: ids });
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da reunião" className="field flex-[2]" autoFocus />
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="field flex-1" />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Ata / anotações" className="field" />
      <fieldset>
        <legend className="mb-1 text-sm font-bold">Participantes</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = ids.includes(m.userId);
            return (
              <label
                key={m.userId}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand text-brand-ink font-bold" : "border-line text-muted"}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => setIds((c) => (on ? c.filter((x) => x !== m.userId) : [...c, m.userId]))}
                />
                {m.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="link text-sm">Cancelar</button>
        <button disabled={pending} className="btn-primary py-1">{pending ? "Salvando..." : submitLabel}</button>
      </div>
    </form>
  );
}

export function Meetings({
  projectId,
  meetings,
  members,
  userId,
  canManage,
}: {
  projectId: string;
  meetings: MeetingT[];
  members: MemberOpt[];
  userId: string;
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Histórico de reuniões</h2>
        {!creating && (
          <button className="btn-primary py-1 text-sm" onClick={() => setCreating(true)}>
            + Nova reunião
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <MeetingForm
            members={members}
            submitLabel="Registrar"
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              await createMeeting(projectId, input);
              setCreating(false);
            }}
          />
        </div>
      )}

      {meetings.length === 0 && !creating && <p className="text-muted">Nenhuma reunião registrada.</p>}

      <ul className="flex flex-col gap-3">
        {meetings.map((m) =>
          editing === m.id ? (
            <li key={m.id}>
              <MeetingForm
                initial={m}
                members={members}
                submitLabel="Salvar"
                onCancel={() => setEditing(null)}
                onSubmit={async (input) => {
                  await updateMeeting(m.id, input);
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={m.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{m.title}</h3>
                  <p className="text-sm text-brand" suppressHydrationWarning>
                    {new Date(m.date).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <button className="link" onClick={() => setEditing(m.id)}>Editar</button>
                  {(canManage || m.createdById === userId) && (
                    <button
                      className="link-danger"
                      onClick={async () => {
                        const ok = await dialog.confirm({
                          title: "Excluir reunião",
                          message: `A reunião "${m.title}" será excluída.`,
                          danger: true,
                        });
                        if (ok) start(() => deleteMeeting(m.id));
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
              {m.attendees.length > 0 && (
                <p className="mt-2 text-sm text-muted">Participantes: {m.attendees.map((a) => a.name).join(", ")}</p>
              )}
              {m.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{m.notes}</p>}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
