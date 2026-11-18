import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, Link2, MessageSquare, Pencil, Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api, type Entry as EntryRow } from '../lib/api';
import { useKindName } from '../lib/kinds';
import { showValue } from '../engine/format';
import type { Field } from '../engine/types';
import { Button, IconButton, Panel, Tag, ago, cn, inputClass, rowClass } from '../ui';
import { DateInput, Select, toast } from '../ui/more';

// La fiche, modifiable (v3 D10, F2): every value corrected where it is read — a click, the right
// input for its type, Entrée to keep, Échap to leave — each change one line of the journal,
// undone from the Activity. A value Jarvis read is confirmed in one click. Links are added and
// taken off here; notes are written here.

export type EditableField = Field & { target?: string };

/** One change of an entry: saved, its views refreshed, a word if it failed. */
export function useEntryChange(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/save', { method: 'POST', body }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entry', id] });
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['history'] });
      void client.invalidateQueries({ queryKey: ['now'] });
    },
  });
}

const READ_ONLY = new Set(['formula', 'lines', 'file', 'button']);
const NUMBER = new Set(['number', 'amount', 'progress', 'integer']);

/** Her entries to choose from (a link): by words, of one kind when the field says which. */
export function EntryPicker({
  kind,
  onPick,
  autoFocus = false,
}: {
  kind?: string | undefined;
  onPick: (entry: EntryRow) => void;
  autoFocus?: boolean;
}) {
  const kindName = useKindName();
  const [q, setQ] = useState('');
  const { data = [], isFetching } = useQuery({
    queryKey: ['entries', 'pick', kind ?? '', q],
    queryFn: () =>
      api<EntryRow[]>(
        `/entries?limit=8${q ? `&text=${encodeURIComponent(q)}` : ''}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`,
      ),
  });
  return (
    <div className="grid gap-1">
      <input
        className={inputClass}
        value={q}
        autoFocus={autoFocus}
        onChange={(event) => setQ(event.target.value)}
        placeholder={
          kind ? `Chercher un(e) ${kindName(kind).toLowerCase()}` : 'Chercher une entrée'
        }
        aria-label="Chercher une entrée à relier"
      />
      <div className="max-h-56 overflow-y-auto rounded-[2px] border border-rule bg-paper">
        {data.length === 0 ? (
          <p className="px-3 py-2 text-[12.5px] text-faint">
            {isFetching ? 'Recherche…' : 'Rien trouvé.'}
          </p>
        ) : (
          data.map((one) => (
            <button
              key={one.id}
              type="button"
              onClick={() => onPick(one)}
              className="flex w-full cursor-pointer items-center gap-2 border-b border-rule px-3 py-2 text-left text-[13px] last:border-0 hover:bg-sand"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{one.title}</span>
              <span className="flex-none text-[12px] text-bark">{kindName(one.kind)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/** One value, read and corrected in place. */
export function FieldRow({
  entryId,
  field,
  value,
  origin,
  display,
}: {
  entryId: string;
  field: EditableField;
  value: unknown;
  origin?: string | undefined;
  /** How it reads when it is not being changed (links, web addresses). */
  display: ReactNode;
}) {
  const change = useEntryChange(entryId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const editable = !READ_ONLY.has(field.type);
  const start = () => {
    setDraft(
      value === null || value === undefined
        ? ''
        : Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'object'
            ? ''
            : String(value),
    );
    setEditing(true);
  };
  const keep = (raw: unknown) => {
    change.mutate(
      { entries: [{ id: entryId, data: { [field.path]: raw }, origin: 'said' }] },
      { onSuccess: () => setEditing(false) },
    );
  };
  const typed = () => {
    if (draft.trim() === '') return null;
    if (NUMBER.has(field.type)) return Number(draft.replace(',', '.'));
    if (field.type === 'multi_choice' || field.type === 'tags')
      return draft
        .split(',')
        .map((one) => one.trim())
        .filter(Boolean);
    if (field.type === 'boolean' || field.type === 'checkbox') return draft === 'true';
    return draft;
  };
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') setEditing(false);
    if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      keep(typed());
    }
  };
  let input: ReactNode = null;
  if (editing) {
    if (field.type === 'link')
      input = <EntryPicker kind={field.target} autoFocus onPick={(one) => keep(one.id)} />;
    else if (field.options?.length && field.type !== 'multi_choice')
      input = (
        <Select
          label={field.label}
          value={draft}
          placeholder="—"
          onChange={(next) => keep(next)}
          options={field.options.map((one) => ({
            value: one,
            label: field.optionLabels?.[one] ?? showValue(one, field),
          }))}
        />
      );
    else if (field.type === 'boolean' || field.type === 'checkbox')
      input = (
        <Select
          label={field.label}
          value={draft}
          placeholder="—"
          onChange={(next) => keep(next === 'true')}
          options={[
            { value: 'true', label: 'oui' },
            { value: 'false', label: 'non' },
          ]}
        />
      );
    else if (field.type === 'date' || field.type === 'datetime')
      input = (
        <DateInput
          label={field.label}
          time={field.type === 'datetime'}
          value={draft.slice(0, field.type === 'date' ? 10 : 16)}
          onChange={setDraft}
        />
      );
    else if (field.type === 'long_text')
      input = (
        <textarea
          className={cn(inputClass, 'h-28 py-2')}
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={keys}
        />
      );
    else
      input = (
        <input
          className={inputClass}
          value={draft}
          autoFocus
          inputMode={NUMBER.has(field.type) ? 'decimal' : undefined}
          placeholder={field.type === 'multi_choice' ? 'séparées par des virgules' : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={keys}
        />
      );
  }
  return (
    <div className="group grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-baseline gap-3 border-b border-rule px-4 py-2.5 last:border-0">
      <dt className="truncate text-[13px] text-bark">{field.label}</dt>
      <dd className="min-w-0 break-words">
        {editing ? (
          <div className="grid gap-2">
            {input}
            <span className="flex gap-1.5">
              {field.type !== 'link' &&
                !(field.options?.length && field.type !== 'multi_choice') && (
                  <Button
                    size="sm"
                    tone="solid"
                    disabled={change.isPending}
                    onClick={() => keep(typed())}
                  >
                    <Check size={14} />
                    Garder
                  </Button>
                )}
              {value !== null && value !== undefined && value !== '' && (
                <Button size="sm" disabled={change.isPending} onClick={() => keep(null)}>
                  Vider
                </Button>
              )}
              <Button size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </span>
          </div>
        ) : (
          <span className="flex min-w-0 flex-wrap items-baseline gap-2">
            {display}
            {origin === 'read' && (
              <>
                <Tag tone="late" dot={false}>
                  lu, à vérifier
                </Tag>
                <button
                  className="cursor-pointer text-[12.5px] font-semibold text-primary hover:underline"
                  disabled={change.isPending}
                  onClick={() => keep(value)}
                >
                  C’est juste
                </button>
              </>
            )}
            {editable && (
              <button
                onClick={start}
                aria-label={`Modifier ${field.label}`}
                className="cursor-pointer text-faint opacity-60 group-hover:opacity-100 hover:text-ink"
              >
                <Pencil size={13} />
              </button>
            )}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Its title, changed in place. */
export function TitleEdit({ entryId, title }: { entryId: string; title: string }) {
  const change = useEntryChange(entryId);
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null)
    return (
      <span className="group inline-flex min-w-0 items-baseline gap-2">
        <span className="truncate">{title}</span>
        <button
          onClick={() => setDraft(title)}
          aria-label="Renommer"
          className="cursor-pointer text-faint opacity-50 group-hover:opacity-100 hover:text-ink"
        >
          <Pencil size={15} />
        </button>
      </span>
    );
  const keep = () => {
    if (!draft.trim() || draft.trim() === title) return setDraft(null);
    change.mutate(
      { entries: [{ id: entryId, title: draft.trim() }] },
      { onSuccess: () => setDraft(null) },
    );
  };
  return (
    <input
      autoFocus
      className={cn(inputClass, 'h-10 font-display text-[20px] font-semibold')}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={keep}
      onKeyDown={(event) => {
        if (event.key === 'Enter') keep();
        if (event.key === 'Escape') setDraft(null);
      }}
      aria-label="Titre"
    />
  );
}

interface LinkView {
  id: string;
  role: string;
  entry: { id: string; kind: string; title: string };
  way: 'out' | 'in';
}

/** Its links, both ways, by kind — one added by a search and a role, one taken off in a click. */
export function LinksPanel({ entryId, links }: { entryId: string; links: LinkView[] }) {
  const kindName = useKindName();
  const change = useEntryChange(entryId);
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState('concerne');
  const byKind = new Map<string, LinkView[]>();
  for (const l of links) byKind.set(l.entry.kind, [...(byKind.get(l.entry.kind) ?? []), l]);
  return (
    <Panel
      title="Ses liens"
      icon={<Link2 size={16} />}
      action={
        !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Relier
          </Button>
        )
      }
    >
      {adding && (
        <div className="grid gap-2 border-b border-rule bg-sand/50 px-4 py-3">
          <label className="flex flex-wrap items-center gap-2 text-[13px]">
            Le lien dit :
            <input
              className={cn(inputClass, 'w-48')}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              aria-label="Ce que dit le lien"
            />
          </label>
          <EntryPicker
            autoFocus
            onPick={(other) =>
              change.mutate(
                { links: [{ from: entryId, to: other.id, role: role.trim() || 'concerne' }] },
                {
                  onSuccess: () => {
                    setAdding(false);
                    toast(`Relié à « ${other.title} ».`);
                  },
                },
              )
            }
          />
          <span>
            <Button size="sm" onClick={() => setAdding(false)}>
              Annuler
            </Button>
          </span>
        </div>
      )}
      {byKind.size === 0 && !adding ? (
        <p className="px-4 py-4 text-[13px] text-bark">Reliée à rien pour l’instant.</p>
      ) : (
        [...byKind.entries()].map(([kind, list]) => (
          <div key={kind}>
            <div className="flex items-center gap-2 border-b border-rule bg-sand px-4 py-1.5">
              <b className="text-[13px] font-semibold">{kindName(kind)}</b>
              <span className="font-mono text-[11px] text-faint">{list.length}</span>
            </div>
            {list.map((l) => (
              <div key={l.id + l.way} className={rowClass + ' relative'}>
                <Link
                  to="/entree/$id"
                  params={{ id: l.entry.id }}
                  className="min-w-0 flex-1 truncate font-semibold after:absolute after:inset-0"
                >
                  {l.entry.title}
                </Link>
                <span className="flex-none text-[12.5px] text-bark">
                  {l.way === 'out' ? l.role : `← ${l.role}`}
                </span>
                <IconButton
                  className="relative z-[1] h-7 w-7"
                  aria-label={`Délier « ${l.entry.title} »`}
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({
                      unlink: [
                        l.way === 'out'
                          ? { from: entryId, to: l.entry.id, role: l.role }
                          : { from: l.entry.id, to: entryId, role: l.role },
                      ],
                    })
                  }
                >
                  <X size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        ))
      )}
    </Panel>
  );
}

interface Note {
  id: string;
  title: string;
  data: { text?: string };
  createdAt: string;
}

/** Her notes on it (spec comments): written here, kept with their day. */
export function NotesPanel({ entryId }: { entryId: string }) {
  const client = useQueryClient();
  const [text, setText] = useState('');
  const { data = [] } = useQuery({
    queryKey: ['entry', entryId, 'notes'],
    queryFn: () => api<Note[]>(`/entries/${entryId}/comments`),
  });
  const write = useMutation({
    mutationFn: () => api(`/entries/${entryId}/comments`, { method: 'POST', body: { text } }),
    onSuccess: () => setText(''),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entry', entryId] });
      void client.invalidateQueries({ queryKey: ['history'] });
    },
  });
  return (
    <Panel title="Notes" icon={<MessageSquare size={16} />}>
      {data.map((one) => (
        <div key={one.id} className="border-b border-rule px-4 py-2.5 text-[13.5px]">
          <p className="whitespace-pre-wrap">{one.data.text ?? one.title}</p>
          <time className="font-mono text-[11px] text-faint">{ago(one.createdAt)}</time>
        </div>
      ))}
      <form
        className="grid gap-2 px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) write.mutate();
        }}
      >
        <textarea
          className={cn(inputClass, 'h-20 py-2')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Une note à garder avec elle"
          aria-label="Nouvelle note"
        />
        <span>
          <Button size="sm" tone="solid" disabled={!text.trim() || write.isPending}>
            Ajouter la note
          </Button>
        </span>
      </form>
    </Panel>
  );
}
