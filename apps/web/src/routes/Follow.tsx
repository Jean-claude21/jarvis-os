import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Plus, Sparkles, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { api } from '../lib/api';
import { Button, Sheet, cn, inputClass } from '../ui';
import { Select, toast } from '../ui/more';

// « Suivre quelque chose » (v3, the collections model): one gesture, anywhere — in « Mes apps », in
// an app's menu. Her phrase gives a first draft (the name, a date, a note); she adjusts its fields
// and chooses the app it lives in (one she has, or a new one); « Créer » and it is there. The
// facets follow from the fields: a date brings it to the agenda and the bilans, an amount to Argent.

export type FieldType =
  | 'text'
  | 'long_text'
  | 'date'
  | 'datetime'
  | 'number'
  | 'amount'
  | 'choice'
  | 'multi_choice'
  | 'boolean'
  | 'rating'
  | 'duration'
  | 'link'
  | 'file'
  | 'location'
  | 'url';
export interface Field {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  target?: string;
}
interface Draft {
  draft: { kind: string; label: string; fields: Field[] };
  apps: string[];
  collections: { kind: string; label: string }[];
}

const TYPE_WORDS: Record<FieldType, string> = {
  text: 'Texte court',
  long_text: 'Texte long',
  date: 'Date',
  datetime: 'Date et heure',
  number: 'Nombre',
  amount: 'Montant',
  choice: 'Choix (un)',
  multi_choice: 'Choix (plusieurs)',
  boolean: 'Oui / non',
  rating: 'Note (étoiles)',
  duration: 'Durée',
  link: 'Lien vers une collection',
  file: 'Fichier',
  location: 'Lieu',
  url: 'Adresse web',
};
/** Where a field's type takes the collection, said before she creates it. */
const BRINGS: [FieldType[], string][] = [
  [['date', 'datetime'], 'l’Agenda, la Frise et les Bilans'],
  [['amount'], 'Argent'],
  [['file'], 'Documents'],
  [['location'], 'la Carte'],
  [['choice'], 'un tableau en colonnes (Kanban)'],
];

let wanted: { app?: string } | null = null;
const listeners = new Set<() => void>();
const set = (next: { app?: string } | null) => {
  wanted = next;
  for (const one of listeners) one();
};
/** Opens « Suivre quelque chose », in an app when one is given. */
export const openFollow = (app?: string) => set(app ? { app } : {});

const NEW_APP = '__new__';

/** The sheet itself, mounted once in the shell. */
export function FollowLayer() {
  const asked = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => wanted,
  );
  if (!asked) return null;
  return <FollowSheet key={asked.app ?? ''} app={asked.app} onClose={() => set(null)} />;
}

function FollowSheet({ app, onClose }: { app?: string | undefined; onClose: () => void }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [phrase, setPhrase] = useState('');
  const [known, setKnown] = useState<Draft | null>(null);
  const [kind, setKind] = useState('');
  const [fields, setFields] = useState<Field[]>([]);
  const [place, setPlace] = useState<string>(app ?? '');
  const [newApp, setNewApp] = useState('');
  const draft = useMutation({
    mutationFn: () => api<Draft>('/collections/draft', { method: 'POST', body: { phrase } }),
    onSuccess: (got) => {
      setKnown(got);
      setKind(got.draft.kind);
      setFields(got.draft.fields);
      if (!app) setPlace(got.apps.length ? '' : NEW_APP);
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const appName = place === NEW_APP ? newApp.trim() : place;
  const create = useMutation({
    mutationFn: () =>
      api<{ kind: string; app: string }>('/collections', {
        method: 'POST',
        body: { kind: kind.trim(), label: kind.trim(), app: appName, fields },
      }),
    onSuccess: (made) => {
      toast(`« ${made.kind} » est prête, dans ${made.app}.`);
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['apps'] });
      void client.invalidateQueries({ queryKey: ['entries'] });
      onClose();
      void navigate({
        to: '/apps/$name',
        params: { name: made.app },
        search: { t: 'data', kind: made.kind },
      });
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const brings = BRINGS.filter(([types]) => fields.some((f) => types.includes(f.type))).map(
    ([, words]) => words,
  );
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title="Suivre quelque chose" wide>
      {!known ? (
        <form
          className="grid gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (phrase.trim().length > 1) draft.mutate();
          }}
        >
          <label className="grid gap-1.5 text-[13.5px]">
            <span className="font-semibold">Qu’est-ce que tu veux suivre ?</span>
            <input
              autoFocus
              className={inputClass}
              value={phrase}
              placeholder="mes actions de grâce, mes cultes, mes lectures…"
              onChange={(event) => setPhrase(event.target.value)}
            />
          </label>
          <p className="text-[12.5px] text-bark">
            Jarvis en fait une collection : tu choisis ses champs et l’app où elle vit. Ensuite tu y
            ajoutes ce que tu vis, à la main, par l’assistant ou par Telegram.
          </p>
          <span>
            <Button
              tone="solid"
              type="submit"
              disabled={draft.isPending || phrase.trim().length < 2}
            >
              Continuer
            </Button>
          </span>
        </form>
      ) : (
        <div className="grid gap-4 p-4">
          <button
            onClick={() => setKnown(null)}
            className="inline-flex w-fit cursor-pointer items-center gap-1 text-[12.5px] text-bark hover:text-ink"
          >
            <ArrowLeft size={13} />
            Changer la phrase
          </button>
          <label className="grid gap-1 text-[13px]">
            <span className="text-bark">Son nom (une chose, au singulier)</span>
            <input className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)} />
          </label>
          <div className="grid gap-1.5 text-[13px]">
            <span className="text-bark">L’app où elle vit</span>
            <Select
              label="App"
              value={place}
              placeholder="Choisir une app"
              onChange={setPlace}
              options={[
                ...known.apps.map((one) => ({ value: one, label: one })),
                { value: NEW_APP, label: 'Une nouvelle app…' },
              ]}
            />
            {place === NEW_APP && (
              <input
                className={inputClass}
                value={newApp}
                placeholder="Vie spirituelle, Maison, Santé…"
                onChange={(e) => setNewApp(e.target.value)}
                aria-label="Nom de la nouvelle app"
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <span className="text-[13px] text-bark">Ses champs</span>
            <FieldsEditor fields={fields} setFields={setFields} collections={known.collections} />
          </div>
          {brings.length > 0 && (
            <p className="text-[12.5px] text-bark">Elle ira aussi dans {brings.join(', ')}.</p>
          )}
          <p className="flex gap-2 rounded-[10px] bg-sand px-3 py-2 text-[12.5px] text-bark">
            <Sparkles size={14} className="mt-0.5 flex-none text-primary" />
            <span>
              Pour une proposition plus riche, dis à ton assistant : « Propose-moi une collection «{' '}
              {kind.trim() || phrase.trim()} »{appName ? ` dans l’app ${appName}` : ''}. » Elle
              t’attendra dans « À valider ».
            </span>
          </p>
          <span className="flex gap-2">
            <Button
              tone="solid"
              disabled={create.isPending || !kind.trim() || !appName || !fields.length}
              onClick={() => create.mutate()}
            >
              Créer la collection
            </Button>
            <Button onClick={onClose}>Annuler</Button>
          </span>
        </div>
      )}
    </Sheet>
  );
}

/**
 * A collection's fields, in her words (« Suivre quelque chose », and a kind's own fields): each a
 * name and one of the 15 simple types, a choice's options, a link's collection. `keepNames` keeps
 * the stored name of a field renamed, so its values stay with it.
 */
export function FieldsEditor({
  fields,
  setFields,
  collections,
  keepNames = false,
}: {
  fields: Field[];
  setFields: (fields: Field[]) => void;
  collections: { kind: string; label: string }[];
  keepNames?: boolean;
}) {
  const change = (at: number, next: Partial<Field>) =>
    setFields(fields.map((one, i) => (i === at ? { ...one, ...next } : one)));
  return (
    <>
      {fields.map((field, at) => (
        <div
          key={at}
          className="grid gap-2 rounded-[10px] border border-rule bg-paper p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,190px)_auto]"
        >
          <input
            className={inputClass}
            value={field.label}
            aria-label="Nom du champ"
            onChange={(e) =>
              change(
                at,
                keepNames ? { label: e.target.value } : { label: e.target.value, name: '' },
              )
            }
          />
          <Select
            label="Genre du champ"
            value={field.type}
            onChange={(type) => change(at, { type })}
            options={(Object.keys(TYPE_WORDS) as FieldType[]).map((one) => ({
              value: one,
              label: TYPE_WORDS[one],
            }))}
          />
          <button
            onClick={() => setFields(fields.filter((_, i) => i !== at))}
            aria-label={`Retirer ${field.label}`}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-[6px] text-bark hover:bg-sand"
          >
            <X size={15} />
          </button>
          {(field.type === 'choice' || field.type === 'multi_choice') && (
            <input
              className={cn(inputClass, 'sm:col-span-3')}
              value={(field.options ?? []).join(', ')}
              placeholder="Ses choix, séparés par des virgules"
              onChange={(e) =>
                change(at, {
                  options: e.target.value
                    .split(',')
                    .map((one) => one.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
          {field.type === 'link' && (
            <div className="sm:col-span-3">
              <Select
                label="Vers quelle collection"
                value={field.target ?? ''}
                placeholder="Vers quelle collection ?"
                onChange={(target) => change(at, { target })}
                options={collections.map((one) => ({
                  value: one.kind,
                  label: one.label,
                }))}
              />
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() =>
          setFields([...fields, { name: '', label: `Champ ${fields.length + 1}`, type: 'text' }])
        }
        className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
      >
        <Plus size={14} />
        Ajouter un champ
      </button>
    </>
  );
}
