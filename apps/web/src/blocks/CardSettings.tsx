import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, LineChart, PieChart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fieldWord } from '../engine/format';
import { api } from '../lib/api';
import { useKindName, useKinds } from '../lib/kinds';
import type { Composable } from '../routes/PageCompose';
import { Button, Sheet, Skeleton, cn, inputClass } from '../ui';
import { Select, toast } from '../ui/more';
import { say } from './Blocks';

// A card set on screen (spec 107): its settings read back as plain answers — its shape, of what,
// how to count, by what, over which time, only which, its columns — changed, then the card set
// anew by the core. The same panel for every component the registry composes; the others change
// their name only (the rest is asked of the assistant). And on a chart, two quick settings: its
// shape and its time.

type Block = Record<string, unknown> & { block: string; title?: unknown };
export interface Answers {
  component: string;
  title?: string;
  kind?: string;
  measure?: string;
  group?: string;
  fields?: string[];
  days?: number;
  within?: Within;
  only?: { field: string; value: string };
  where?: string;
  inPeriod?: boolean;
  parts?: string[];
}
type Within = 'month' | '3m' | '6m' | '12m';
/** A change of answers: a setting given, or cleared (`undefined`). */
type Patch = { [K in keyof Answers]?: Answers[K] | undefined };

const WITHINS: { value: Within | 'all'; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'month', label: 'Ce mois' },
  { value: '3m', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '12m', label: '12 mois' },
];

/** A card's answers, read by the core; null when only its name changes on screen. */
export function useAnswers(block: Block | null) {
  return useQuery({
    queryKey: ['cards', 'answers', JSON.stringify(block)],
    queryFn: () =>
      api<{ answers: Answers | null; settable: boolean }>('/cards/answers', {
        method: 'POST',
        body: { block },
      }),
    enabled: !!block,
  });
}

/** The card set anew from her answers (the core checks them and says what is wrong). */
export const reshape = (block: Block, answers: Answers) =>
  api<{ block: Block }>('/cards/reshape', { method: 'POST', body: { block, answers } }).then(
    (one) => one.block,
  );

/** « Régler »: the panel of one card. */
export function CardSettings({
  block,
  open,
  onOpenChange,
  onApply,
}: {
  block: Block;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (block: Block) => void;
}) {
  const kindName = useKindName();
  const { data: kinds = [] } = useKinds();
  const read = useAnswers(open ? block : null);
  const composable = useQuery({
    queryKey: ['pages', 'composable', ''],
    queryFn: () => api<Composable>('/pages/composable'),
    enabled: open,
  });
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (!open) return;
    setAnswers(read.data?.answers ?? null);
    setTitle(read.data?.answers?.title ?? say(block.title as never, ''));
  }, [open, read.data, block.title]);
  const apply = useMutation({
    mutationFn: async () => {
      if (!answers) return { ...block, title: title.trim() || block.title };
      return reshape(block, { ...answers, ...(title.trim() ? { title: title.trim() } : {}) });
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: (set) => {
      onApply(set);
      onOpenChange(false);
    },
  });
  const set = (patch: Patch) =>
    setAnswers((was) => {
      if (!was) return was;
      const next = { ...was, ...patch } as Answers;
      for (const key of Object.keys(patch) as (keyof Answers)[])
        if (patch[key] === undefined) delete next[key];
      return next;
    });
  const info = composable.data?.components.find((one) => one.id === answers?.component);
  const shape = composable.data?.kinds.find((one) => one.kind === answers?.kind);
  const model = kinds.find((one) => one.kind === answers?.kind)?.model;
  const label = (name: string) =>
    name === 'month'
      ? 'Mois'
      : ((
          model?.fields?.find((one) => one.name === name) as { label?: { fr?: string } } | undefined
        )?.label?.fr ?? fieldWord(name));
  // The fields she can keep only one value of: those with choices.
  const choices = (model?.fields ?? [])
    .map((one) => one as { name: string; type: string; options?: string[] })
    .filter((one) => one.options?.length);
  const onlyField = choices.find((one) => one.name === answers?.only?.field);
  const dated = shape?.groups.includes('month') ?? false;
  const shapes = (composable.data?.components ?? []).filter(
    (one) => !one.asks.includes('kind') || (answers?.kind && one.kinds.includes(answers.kind)),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Régler la carte">
      {read.isLoading || (open && !composable.data && read.data?.answers) ? (
        <Skeleton className="m-4 h-40" />
      ) : (
        <form
          className="grid gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            apply.mutate();
          }}
        >
          <label className="grid gap-1 text-[13px]">
            <span className="text-bark">Nom</span>
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {!answers ? (
            <p className="text-[13px] text-bark">
              Cette carte a été écrite par ton assistant : ici, son nom et sa taille. Pour le reste,
              demande-le à Claude.
            </p>
          ) : (
            <>
              <Select
                label="Forme"
                value={answers.component}
                onChange={(component) => set({ component })}
                options={shapes.map((one) => ({ value: one.id, label: one.label.fr }))}
              />
              {info?.asks.includes('kind') && (
                <Select
                  label="De quoi"
                  value={answers.kind ?? ''}
                  onChange={(kind) =>
                    set({
                      kind,
                      measure: undefined,
                      group: undefined,
                      fields: undefined,
                      only: undefined,
                    })
                  }
                  options={info.kinds.map((one) => ({ value: one, label: kindName(one) }))}
                />
              )}
              {info?.asks.includes('measure') && shape && (
                <Select
                  label="Compter"
                  value={answers.measure ?? 'count'}
                  onChange={(measure) => set({ measure })}
                  options={[
                    { value: 'count', label: 'Le nombre' },
                    ...shape.measures.map((one) => ({
                      value: one,
                      label: `La somme de ${label(one).toLowerCase()}`,
                    })),
                  ]}
                />
              )}
              {info?.asks.includes('group') && shape && (
                <Select
                  label="Par"
                  value={answers.group ?? ''}
                  placeholder="Choisir"
                  onChange={(group) => set({ group })}
                  options={shape.groups.map((one) => ({ value: one, label: label(one) }))}
                />
              )}
              {dated && answers.kind && (
                <Select
                  label="Sur"
                  value={answers.within ?? 'all'}
                  onChange={(value) => set({ within: value === 'all' ? undefined : value })}
                  options={WITHINS}
                />
              )}
              {answers.kind && choices.length > 0 && (
                <div className="grid gap-1 text-[13px]">
                  <span className="text-bark">Seulement</span>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      label="Seulement : le champ"
                      value={answers.only?.field ?? ''}
                      placeholder="Tout"
                      onChange={(field) =>
                        set({
                          only: field
                            ? {
                                field,
                                value: choices.find((one) => one.name === field)!.options![0]!,
                              }
                            : undefined,
                        })
                      }
                      options={[
                        { value: '', label: 'Tout' },
                        ...choices.map((one) => ({ value: one.name, label: label(one.name) })),
                      ]}
                      className="w-44"
                    />
                    {onlyField && (
                      <Select
                        label="Seulement : la valeur"
                        value={answers.only!.value}
                        onChange={(value) => set({ only: { field: onlyField.name, value } })}
                        options={onlyField.options!.map((one) => ({ value: one, label: one }))}
                        className="w-44"
                      />
                    )}
                  </div>
                </div>
              )}
              {info?.asks.includes('fields') && shape && (
                <fieldset className="grid gap-1 rounded-[2px] border border-rule px-3 py-2 text-[13px]">
                  <legend className="px-1 text-bark">Colonnes</legend>
                  {shape.fields.map((one) => (
                    <label key={one} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(answers.fields ?? []).includes(one)}
                        onChange={(event) =>
                          set({
                            fields: event.target.checked
                              ? [...(answers.fields ?? []), one]
                              : (answers.fields ?? []).filter((f) => f !== one),
                          })
                        }
                      />
                      {label(one)}
                    </label>
                  ))}
                </fieldset>
              )}
              {info?.asks.includes('days') && (
                <label className="grid gap-1 text-[13px]">
                  <span className="text-bark">Sur combien de jours</span>
                  <input
                    type="number"
                    min={1}
                    max={366}
                    className={inputClass}
                    value={answers.days ?? ''}
                    onChange={(event) =>
                      set({ days: event.target.value ? Number(event.target.value) : undefined })
                    }
                  />
                </label>
              )}
              {answers.where && (
                <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-bark">
                  Garde aussi la condition de ton assistant : <code>{answers.where}</code>
                  <Button
                    size="sm"
                    tone="quiet"
                    type="button"
                    onClick={() => set({ where: undefined })}
                  >
                    Retirer
                  </Button>
                </p>
              )}
            </>
          )}
          <span className="flex gap-2">
            <Button tone="solid" type="submit" disabled={apply.isPending}>
              Appliquer
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          </span>
        </form>
      )}
    </Sheet>
  );
}

const CHARTS = [
  { value: 'bar', label: 'Barres', icon: BarChart3 },
  { value: 'line', label: 'Courbe', icon: LineChart },
  { value: 'breakdown', label: 'Répartition', icon: PieChart },
] as const;

/**
 * On a chart (spec 107), without « Modifier »: its shape and its time, one gesture each, kept on
 * the page. A curve needs a date; a time needs a date too.
 */
export function QuickChart({
  block,
  dated,
  onChange,
}: {
  block: Block;
  dated: boolean;
  onChange: (block: Block) => Promise<void>;
}) {
  const read = useAnswers(block);
  const answers = read.data?.answers;
  const change = useMutation({
    mutationFn: async (patch: Patch) => {
      const next = { ...answers!, ...patch } as Answers;
      if (patch.within === undefined && 'within' in patch) delete next.within;
      // Barres and Répartition need a group: a curve's month, when she had none.
      if ((next.component === 'bar' || next.component === 'breakdown') && !next.group && dated)
        next.group = 'month';
      await onChange(await reshape(block, next));
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  if (!answers) return null;
  const name = say(block.title as never, block.block);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span role="group" aria-label={`Forme de « ${name} »`} className="flex">
        {CHARTS.filter((one) => one.value !== 'line' || dated).map(
          ({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              title={label}
              aria-label={`${label} pour « ${name} »`}
              aria-pressed={block.block === value}
              disabled={change.isPending}
              onClick={() => block.block !== value && change.mutate({ component: value })}
              className={cn(
                'grid h-7 w-7 cursor-pointer place-items-center border border-rule first:rounded-l-[2px] last:rounded-r-[2px]',
                block.block === value ? 'bg-ink text-paper' : 'bg-paper text-bark hover:text-ink',
              )}
            >
              <Icon size={14} />
            </button>
          ),
        )}
      </span>
      {dated && (
        <Select
          label={`Période de « ${name} »`}
          value={answers.within ?? 'all'}
          onChange={(value) => change.mutate({ within: value === 'all' ? undefined : value })}
          options={WITHINS}
          className="w-28"
        />
      )}
    </span>
  );
}
