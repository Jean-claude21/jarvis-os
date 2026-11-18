import { Link } from '@tanstack/react-router';
import { peek } from '../engine/peek';
import { Stat, Stats, Tag, cn } from '../ui';
import type { BlockProps } from './Blocks';

// What a period gave (v3 F4), computed by Jarvis: the « Revue » format's own block, and the facts
// shown beside a « Bilan » still to write. Any page can hold it.

const euros = (n: number) =>
  `${n.toLocaleString('fr', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
/** Money's ways, in her words. */
const DIRECTIONS: Record<string, string> = {
  in: 'Entrées',
  out: 'Sorties',
  transfer: 'Virements',
  entrée: 'Entrées',
  sortie: 'Sorties',
};
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)} %`);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-rule px-4 py-3 last:border-0">
      <h3 className="mb-2 text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const EntryChip = ({ id, title }: { id: string; title: string }) => (
  <Link
    to="."
    search={peek(id)}
    className="inline-flex max-w-full items-center rounded-[6px] border border-rule bg-paper px-2 py-0.5 text-[12.5px] hover:border-rule-strong"
  >
    <span className="truncate">{title}</span>
  </Link>
);

interface Highlights {
  figures?: { made: number; done: number; kept: number; late: number };
  done?: { id: string; title: string }[];
  money?: { direction: string; total: number }[];
  spending?: { name: string; now: number; usual: number }[];
  goals?: { id: string; title: string; ratio: number | null; daysLeft: number | null }[];
  habits?: { id: string; title: string; kept: number; planned: number }[];
  commitments?: { id: string; title: string; due: string; state: 'done' | 'late' | 'ahead' }[];
  people?: { id: string; title: string; n: number }[];
  intentions?: { id: string; title: string; times: number }[];
}

/** What the period gave: figures, then each part she asked for, only when it has something. */
export function HighlightsBlock({ block }: BlockProps) {
  const one = block as unknown as Highlights;
  const parts: React.ReactNode[] = [];
  if (one.figures)
    parts.push(
      <div key="figures" className="p-3">
        <Stats>
          <Stat label="Entrées ajoutées" value={one.figures.made} />
          <Stat label="Choses faites" value={one.figures.done} />
          <Stat label="Engagements tenus" value={one.figures.kept} />
          <Stat label="En retard" value={one.figures.late} bad={one.figures.late > 0} />
        </Stats>
      </div>,
    );
  if (one.done?.length)
    parts.push(
      <Section key="done" title={`Fait (${one.done.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {one.done.map((d) => (
            <EntryChip key={d.id} id={d.id} title={d.title} />
          ))}
        </div>
      </Section>,
    );
  if (one.commitments?.length)
    parts.push(
      <Section key="commitments" title="Engagements">
        <ul className="grid gap-1 text-[13px]">
          {one.commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Tag tone={c.state === 'done' ? 'ok' : c.state === 'late' ? 'late' : 'neutral'}>
                {c.state === 'done' ? 'tenu' : c.state === 'late' ? 'en retard' : 'à venir'}
              </Tag>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
            </li>
          ))}
        </ul>
      </Section>,
    );
  if (one.goals?.length)
    parts.push(
      <Section key="goals" title="Objectifs">
        <ul className="grid gap-2 text-[13px]">
          {one.goals.map((g) => (
            <li key={g.id} className="grid gap-1">
              <span className="flex justify-between gap-2">
                <span className="truncate">{g.title}</span>
                <span className="font-mono text-[12px] text-bark">{pct(g.ratio)}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-sand">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((g.ratio ?? 0) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </Section>,
    );
  if (one.habits?.length)
    parts.push(
      <Section key="habits" title="Habitudes">
        <ul className="grid gap-1 text-[13px]">
          {one.habits.map((h) => (
            <li key={h.id} className="flex justify-between gap-2">
              <span className="truncate">{h.title}</span>
              <span className="font-mono text-[12px] text-bark">
                {h.kept}/{h.planned}
              </span>
            </li>
          ))}
        </ul>
      </Section>,
    );
  const spending = (one.spending ?? []).filter((s) => s.name && s.name !== '—');
  if (one.money?.length || spending.length)
    parts.push(
      <Section key="money" title="Argent">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {(one.money ?? []).map((m) => (
            <span key={m.direction}>
              <span className="text-bark">{DIRECTIONS[m.direction] ?? m.direction} </span>
              <b>{euros(m.total)}</b>
            </span>
          ))}
        </div>
        {spending.length > 0 && (
          <ul className="mt-2 grid gap-1 text-[13px]">
            {spending.slice(0, 6).map((s) => (
              <li key={s.name} className="flex justify-between gap-2">
                <span className="truncate">{s.name}</span>
                <span
                  className={cn(
                    'font-mono text-[12px]',
                    s.now > s.usual ? 'text-error' : 'text-bark',
                  )}
                >
                  {euros(s.now)} · d’habitude {euros(s.usual)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>,
    );
  if (one.people?.length)
    parts.push(
      <Section key="people" title="Personnes">
        <div className="flex flex-wrap gap-1.5">
          {one.people.map((p) => (
            <EntryChip key={p.id} id={p.id} title={`${p.title} · ${p.n}`} />
          ))}
        </div>
      </Section>,
    );
  if (one.intentions?.length)
    parts.push(
      <Section key="intentions" title="Dit, pas encore fait">
        <ul className="grid gap-1 text-[13px]">
          {one.intentions.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span className="truncate">{i.title}</span>
              <span className="font-mono text-[12px] text-bark">{i.times}×</span>
            </li>
          ))}
        </ul>
      </Section>,
    );
  if (!parts.length)
    return <p className="px-4 py-5 text-[13px] text-bark">Rien de marquant sur cette période.</p>;
  return <div>{parts}</div>;
}
