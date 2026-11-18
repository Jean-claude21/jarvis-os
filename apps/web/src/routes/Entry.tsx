import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import {
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  History,
  ListTree,
  Paperclip,
  RotateCw,
  Upload,
  UserRound,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { api, type JournalLine } from '../lib/api';
import { useKinds, useKindName } from '../lib/kinds';
import { useSession } from '../lib/session';
import { useDropTarget, useUpload } from '../lib/upload';
import { GENRE_WORDS, said, whoOf } from '../lib/words';
import { fieldWord, showValue } from '../engine/format';

import { Avatar, Button, PageHead, Panel, Skeleton, Tag, ago, rowClass } from '../ui';
import { Identity, WhoActions, type Who } from '../ui/identity';
import { Markdown } from '../ui/Markdown';
import { FieldRow, LinksPanel, NotesPanel, TitleEdit, type EditableField } from './EntryParts';

// La fiche (v3 D10): one entry, drawn from its kind's facets — who it is (avatar, logo, the
// gestures that reach them, the last contact), what a document is (its preview, what Jarvis read
// in it, each fact with its words), its values in her words (« lu » when read, not said), its
// links both ways, the files joined to it (drop one anywhere on the page), and its history.

interface ModelField {
  name: string;
  type: string;
  label?: Record<string, string>;
  options?: string[];
  optionLabels?: Record<string, Record<string, string>>;
  /** A link field's kind. */
  target?: string;
}
interface KindShape {
  kind: string;
  facets?: {
    facet: string;
    kind?: string;
    email?: string;
    phone?: string;
    domain?: string;
    text?: string;
  }[];
  model?: { fields?: ModelField[] };
}
interface LinkView {
  id: string;
  role: string;
  entry: { id: string; kind: string; title: string };
}
interface FullEntry {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  origin: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  links: { out: LinkView[]; in: LinkView[] };
}
interface PersonCard {
  last: { id: string; kind: string; title: string; on: string } | null;
  promises: { id: string; kind: string; title: string; due: string | null }[];
  next: { id: string; kind: string; title: string; on: string } | null;
}
interface ReadFact {
  value: string | number;
  quote: string;
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);

/** Keys Jarvis keeps for itself on an entry: never shown as her values. */
const OWN = new Set(['text', 'source_connection', 'genre', 'facts', 'nom', 'type', 'taille']);
const FACT_WORDS: Record<string, string> = {
  amount: 'Montant',
  date: 'Date',
  due: 'Échéance',
  supplier: 'De',
  warranty: 'Garantie',
};
const factText = (key: string, fact: ReadFact) =>
  key === 'amount'
    ? `${Number(fact.value).toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : key === 'warranty'
      ? `${fact.value} mois`
      : showValue(fact.value);
const label = (one: Record<string, string> | undefined, fallback: string) =>
  one?.fr ?? one?.en ?? fallback;

export function EntryPage() {
  const { id } = useParams({ from: '/entree/$id' });
  return <EntryView id={id} />;
}

/**
 * The fiche of one entry — a page of its own, or the right side of a « Liste + détail » (v3 D21,
 * `embedded`: one column, the list beside it).
 */
export function EntryView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { me } = useSession();
  const client = useQueryClient();
  const kindName = useKindName();
  const { data: kinds = [] } = useKinds();
  const entry = useQuery({
    queryKey: ['entry', id],
    queryFn: () => api<FullEntry>(`/entries/${id}`),
  });
  const history = useQuery({
    queryKey: ['history', 'entry', id],
    queryFn: () => api<JournalLine[]>(`/history?limit=30&target=${encodeURIComponent(id)}`),
  });
  const isPerson = !!entry.data && /^person$/i.test(entry.data.kind);
  const card = useQuery({
    queryKey: ['entry', id, 'card'],
    queryFn: () => api<PersonCard>(`/people/${id}`),
    enabled: isPerson,
  });
  const reread = useMutation({
    mutationFn: () => api(`/files/${id}/understand`, { method: 'POST' }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entry', id] });
      void client.invalidateQueries({ queryKey: ['now'] });
    },
  });
  const { send, busy } = useUpload();
  const input = useRef<HTMLInputElement>(null);
  // The empty fields of her model wait behind one line, so the values she has come first.
  const [filling, setFilling] = useState(false);
  useDropTarget(entry.data ? { id: entry.data.id, title: entry.data.title } : null);

  if (entry.isLoading) return <Skeleton className="h-40" />;
  if (!entry.data)
    return <PageHead title="Introuvable" lead="Cette entrée n’existe pas dans cet espace." />;
  const one = entry.data;
  const shape = (kinds as KindShape[]).find((k) => k.kind === one.kind);
  const facet = (name: string) => shape?.facets?.find((f) => f.facet === name);
  const whoFacet = facet('who');
  const text = (key?: string) =>
    key && typeof one.data[key] === 'string' ? (one.data[key] as string) : null;
  const who: Who | null = whoFacet
    ? {
        kind: whoFacet.kind === 'organization' ? 'organization' : 'person',
        email: text(whoFacet.email),
        phone: text(whoFacet.phone),
        domain: text(whoFacet.domain),
      }
    : null;
  const mediaType = text('type') ?? '';
  const isFile = /^fichier$/i.test(one.kind) && !!text('nom');
  const genre = text('genre');
  const facts = (one.data.facts ?? {}) as Record<string, ReadFact>;

  // Her values, in her model's order and words; then any other she gave.
  const modelFields = shape?.model?.fields ?? [];
  const fieldOf = (name: string): EditableField => {
    const own = modelFields.find((f) => f.name === name);
    return {
      ...(own?.target ? { target: own.target } : {}),
      path: name,
      type: own?.type ?? 'text',
      label: label(own?.label, fieldWord(name)),
      ...(own?.options ? { options: own.options } : {}),
      ...(own?.optionLabels
        ? {
            optionLabels: Object.fromEntries(
              Object.entries(own.optionLabels).map(([code, words]) => [code, label(words, code)]),
            ),
          }
        : {}),
    };
  };
  // Every field of her model — the empty ones too, to fill in place — then any other she gave.
  const names = [
    ...modelFields
      .filter((f) => !['lines', 'button'].includes(f.type))
      .filter((f) => f.type !== 'formula' || f.name in one.data)
      .map((f) => f.name),
    ...Object.keys(one.data).filter(
      (name) => !modelFields.some((f) => f.name === name) && (one.data[name] ?? '') !== '',
    ),
  ].filter((name) => !OWN.has(name));
  const linkedBy = (role: string) => one.links.out.filter((l) => l.role === role);

  // Its links, both ways (notes and files apart, the fields that are links in its values).
  const files = [...one.links.in, ...one.links.out].filter((l) => /^fichier$/i.test(l.entry.kind));
  const others = [
    ...one.links.out.map((l) => ({ ...l, way: 'out' as const })),
    ...one.links.in.map((l) => ({ ...l, way: 'in' as const })),
  ].filter(
    (l) =>
      !/^fichier$/i.test(l.entry.kind) &&
      !/^comment$/i.test(l.entry.kind) &&
      l.role !== 'from_proposal' &&
      !modelFields.some((f) => f.type === 'link' && f.name === l.role && l.way === 'out'),
  );

  return (
    <>
      <PageHead
        icon={who ? <Identity name={one.title} who={who} size={40} /> : undefined}
        title={<TitleEdit key={one.title} entryId={one.id} title={one.title} />}
        lead={
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag tone="neutral">{kindName(one.kind)}</Tag>
            {genre && GENRE_WORDS[genre] && (
              <Tag tone="info" dot={false}>
                {GENRE_WORDS[genre]}
              </Tag>
            )}
            <span className="text-faint">modifié {ago(one.updatedAt)}</span>
          </span>
        }
        actions={who ? <WhoActions who={who} /> : undefined}
      />
      <div
        className={
          'grid items-start gap-4 ' +
          (embedded
            ? '2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]')
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          {isFile && (
            <Panel
              title="Le document"
              icon={<FileSearch size={16} />}
              action={
                <span className="flex flex-wrap gap-2">
                  <a
                    href={`/api/files/${one.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
                  >
                    <ExternalLink size={14} />
                    Ouvrir
                  </a>
                  <a
                    href={`/api/files/${one.id}?download=1`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
                  >
                    <Download size={14} />
                    Télécharger
                  </a>
                </span>
              }
            >
              {!(genre === 'other' && Object.keys(facts).length === 0) && (
                <div className="border-b border-rule px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-[13px] font-semibold">Ce que Jarvis y a lu</b>
                    <Button size="sm" disabled={reread.isPending} onClick={() => reread.mutate()}>
                      <RotateCw size={14} />
                      Relire
                    </Button>
                  </div>
                  {Object.keys(facts).length === 0 ? (
                    <p className="text-[13px] text-bark">
                      {genre
                        ? 'Rien de chiffré ici.'
                        : 'Pas encore lu : la lecture se fait juste après le dépôt.'}
                    </p>
                  ) : (
                    <dl className="grid gap-2">
                      {Object.entries(facts).map(([key, fact]) => (
                        <div
                          key={key}
                          className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-3"
                        >
                          <dt className="text-[13px] text-bark">{FACT_WORDS[key] ?? key}</dt>
                          <dd className="min-w-0">
                            <span className="font-semibold">{factText(key, fact)}</span>
                            <span
                              className="block truncate font-mono text-[11.5px] text-faint"
                              title={fact.quote}
                            >
                              « {fact.quote} »
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-2 text-xs text-faint">
                    Lu par Jarvis, à vérifier. Ce qu’il en tire t’attend dans « À valider ».
                  </p>
                </div>
              )}
              {/pdf/.test(mediaType) ? (
                <iframe
                  src={`/api/files/${one.id}#view=FitH`}
                  title={one.title}
                  className="block h-[min(62vh,620px)] w-full border-0 bg-sand"
                />
              ) : /^image\//.test(mediaType) ? (
                <img
                  src={`/api/files/${one.id}`}
                  alt={one.title}
                  className="mx-auto block max-h-[70vh] max-w-full object-contain p-3"
                />
              ) : (
                <FilePreview id={one.id} mediaType={mediaType} name={text('nom') ?? one.title} />
              )}
            </Panel>
          )}
          {text('text') && !isFile && (
            <Panel title="Le texte" icon={<FileText size={16} />}>
              <Markdown text={text('text')!} className="px-4 py-4 sm:px-5" />
            </Panel>
          )}
          <Panel title="Propriétés" icon={<ListTree size={16} />}>
            {names.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-bark">Aucune valeur.</p>
            ) : (
              <dl>
                {names
                  .filter((name) => filling || !isEmpty(one.data[name]))
                  .map((name) => {
                    const field = fieldOf(name);
                    const links = field.type === 'link' ? linkedBy(name) : [];
                    const value = one.data[name];
                    return (
                      <FieldRow
                        key={name}
                        entryId={one.id}
                        field={field}
                        value={value}
                        origin={one.origin[name]}
                        display={
                          links.length ? (
                            links.map((l) => (
                              <Link
                                key={l.id}
                                to="/entree/$id"
                                params={{ id: l.entry.id }}
                                className="font-semibold hover:underline"
                              >
                                {l.entry.title}
                              </Link>
                            ))
                          ) : field.type === 'url' && typeof value === 'string' ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {value}
                            </a>
                          ) : (
                            <span className={showValue(value, field) ? '' : 'text-faint'}>
                              {showValue(value, field) || '—'}
                            </span>
                          )
                        }
                      />
                    );
                  })}
              </dl>
            )}
            {names.some((name) => isEmpty(one.data[name])) && (
              <button
                onClick={() => setFilling(!filling)}
                className="w-full cursor-pointer border-t border-rule px-4 py-2.5 text-left text-[13px] font-semibold text-primary hover:bg-sand"
              >
                {filling
                  ? 'Cacher les champs vides'
                  : `Compléter : ${names.filter((name) => isEmpty(one.data[name])).length} champ(s) vide(s)`}
              </button>
            )}
          </Panel>
          <LinksPanel entryId={one.id} links={others} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {isPerson && card.data && (
            <Panel title="Avec cette personne" icon={<UserRound size={16} />}>
              <dl className="grid gap-2.5 px-4 py-3 text-[13px]">
                <div>
                  <dt className="text-bark">Dernier contact</dt>
                  <dd className="font-semibold">
                    {card.data.last ? (
                      <Link
                        to="/entree/$id"
                        params={{ id: card.data.last.id }}
                        className="hover:underline"
                      >
                        {card.data.last.title} · {showValue(card.data.last.on)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-bark">Prochain</dt>
                  <dd className="font-semibold">
                    {card.data.next ? (
                      <Link
                        to="/entree/$id"
                        params={{ id: card.data.next.id }}
                        className="hover:underline"
                      >
                        {card.data.next.title} · {showValue(card.data.next.on)}
                      </Link>
                    ) : (
                      'rien de prévu'
                    )}
                  </dd>
                </div>
                {card.data.promises.length > 0 && (
                  <div>
                    <dt className="text-bark">Ce que tu lui as promis</dt>
                    {card.data.promises.slice(0, 4).map((p) => (
                      <dd key={p.id}>
                        <Link to="/entree/$id" params={{ id: p.id }} className="hover:underline">
                          {p.title}
                        </Link>
                        {p.due ? <span className="text-faint"> · {showValue(p.due)}</span> : null}
                      </dd>
                    ))}
                  </div>
                )}
              </dl>
            </Panel>
          )}
          {!isFile && (
            <Panel
              title="Fichiers joints"
              icon={<Paperclip size={16} />}
              action={
                <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
                  <Upload size={14} />
                  Joindre
                </Button>
              }
            >
              <input
                ref={input}
                type="file"
                multiple
                hidden
                onChange={(event) => void send([...(event.target.files ?? [])], one.id)}
              />
              {files.map((l) => (
                <Link key={l.id} to="/entree/$id" params={{ id: l.entry.id }} className={rowClass}>
                  <Paperclip size={14} className="flex-none text-bark" />
                  <span className="min-w-0 flex-1 truncate">{l.entry.title}</span>
                </Link>
              ))}
              <p className="px-4 py-3 text-[12.5px] text-faint">
                {busy
                  ? 'Dépôt en cours…'
                  : 'Glisse un fichier n’importe où sur la page pour le joindre ici.'}
              </p>
            </Panel>
          )}
          <NotesPanel entryId={one.id} />
          <Panel title="Son histoire" icon={<History size={16} />}>
            <ul className="max-h-[60vh] overflow-y-auto">
              {(history.data ?? []).map((line) => {
                const by = whoOf(line, me.person.id);
                return (
                  <li
                    key={line.id}
                    className="flex items-start gap-2.5 border-b border-rule px-4 py-2.5 last:border-0"
                  >
                    <Avatar name={by.name} size={26} />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b className="font-semibold">{by.name}</b> {said(line.command)}
                    </span>
                    <time className="flex-none font-mono text-[11px] text-faint">
                      {ago(line.at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

const TEXTUAL = (mediaType: string, name: string) =>
  /^text\/|json|xml|csv|markdown|yaml/.test(mediaType) ||
  /\.(md|markdown|txt|csv|tsv|json|log|ya?ml|xml)$/i.test(name);
const MARKDOWN = (mediaType: string, name: string) =>
  /markdown/.test(mediaType) || /\.(md|markdown)$/i.test(name);

/** A table's rows from a CSV (« ; », « , » or a tab): the first is its head. */
function csvRows(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 201);
  const first = lines[0] ?? '';
  const sep = first.includes('\t')
    ? '\t'
    : first.split(';').length > first.split(',').length
      ? ';'
      : ',';
  return lines.map((line) => line.split(sep).map((cell) => cell.replace(/^"|"$/g, '').trim()));
}

/**
 * Any file, read on its page (v3 V7): a note in Markdown as a page, a text or a CSV as they are,
 * a sound or a video played, a Word document by the words Jarvis read in it.
 */
function FilePreview({ id, mediaType, name }: { id: string; mediaType: string; name: string }) {
  const textual = TEXTUAL(mediaType, name);
  const media = /^(audio|video)\//.test(mediaType);
  const raw = useQuery({
    queryKey: ['entry', id, 'raw'],
    queryFn: async () => {
      const response = await fetch(`/api/files/${id}`, { credentials: 'same-origin' });
      return (await response.text()).slice(0, 400_000);
    },
    enabled: textual,
  });
  const read = useQuery({
    queryKey: ['entry', id, 'words'],
    queryFn: () => api<{ text: string | null; state: string }>(`/files/${id}/text`),
    enabled: !textual && !media,
  });
  if (/^audio\//.test(mediaType))
    return <audio controls src={`/api/files/${id}`} className="block w-full p-3" />;
  if (/^video\//.test(mediaType))
    return <video controls src={`/api/files/${id}`} className="block max-h-[70vh] w-full bg-ink" />;
  if (textual) {
    if (raw.isLoading) return <Skeleton className="m-4 h-24" />;
    const body = raw.data ?? '';
    if (MARKDOWN(mediaType, name)) return <Markdown text={body} className="px-4 py-4 sm:px-5" />;
    if (/csv|tab-separated/.test(mediaType) || /\.(csv|tsv)$/i.test(name)) {
      const [head = [], ...rows] = csvRows(body);
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="bg-sand text-left">
                {head.map((cell, at) => (
                  <th
                    key={at}
                    className="border-b border-rule px-3 py-2 font-semibold whitespace-nowrap"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, at) => (
                <tr key={at} className="border-b border-rule last:border-0">
                  {row.map((cell, n) => (
                    <td key={n} className="px-3 py-1.5 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <pre className="max-h-[70vh] overflow-auto px-4 py-3 font-mono text-[12.5px] whitespace-pre-wrap">
        {body}
      </pre>
    );
  }
  if (read.isLoading) return <Skeleton className="m-4 h-24" />;
  if (read.data?.text)
    return (
      <div className="px-4 py-3">
        <b className="mb-1.5 block text-[13px] font-semibold">Son texte, tel que Jarvis l’a lu</b>
        <p className="max-h-[60vh] overflow-y-auto text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {read.data.text}
        </p>
      </div>
    );
  return (
    <p className="px-4 py-5 text-[13px] text-bark">
      {read.data?.state === 'pending'
        ? 'Lecture en cours : son texte apparaîtra ici.'
        : `${name} · pas d’aperçu pour ce format : ouvre-le ou télécharge-le.`}
    </p>
  );
}
