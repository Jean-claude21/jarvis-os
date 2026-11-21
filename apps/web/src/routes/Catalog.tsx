import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MessageSquareText, Play } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useKinds, useKindName } from '../lib/kinds';
import { BLOCK_RENDERS, BlockView, type Drawn, type Vocabulary } from '../blocks/Blocks';
import { Avatar, Button, Empty, Menu, Panel, Segmented, Skeleton, Tabs, Tag, cn } from '../ui';
import { Identity } from '../ui/identity';
import { Markdown } from '../ui/Markdown';
import { DateInput, DropZone, FileIcon, Select, toast, useConfirm } from '../ui/more';
import { CatalogCards } from '../blocks/Cards';

// The catalogue of components (v3 D21): every component of the registry, by category — a live
// preview, when to use it, what it needs, its names, the sentence to say to Claude, and for a
// page block « Essayer avec mes données ». The registry is the core's (`GET /components`): a
// component added there appears here by itself.

interface Info {
  id: string;
  aliases: string[];
  category: string;
  label: { fr: string; en: string };
  when: string;
  needs?: { facets?: string[]; fields?: string[] };
  block?: boolean;
}
interface Registry {
  categories: { id: string; fr: string }[];
  components: Info[];
}

const FACET_WORDS: Record<string, string> = {
  dated: 'Daté',
  todo: 'À faire',
  recurring: 'Récurrent',
  measurable: 'Mesurable',
  amount: 'Montant',
  stages: 'Étapes',
  document: 'Document',
  who: 'Personne / organisation',
  place: 'Lieu',
};

/** What each page block looks like, with example data (the same shapes the core computes). */
const DEMO: Record<string, Drawn> = {
  stat: { block: 'stat', title: 'Offres', value: 42, unit: null },
  stat_delta: {
    block: 'stat_delta',
    title: 'Dépenses du mois',
    value: 812,
    previous: 960,
    delta: -15.4,
    unit: '€',
  },
  gauge: {
    block: 'gauge',
    title: 'Fonds',
    items: [
      { id: 'x1', label: 'Courses', value: 212, max: 300 },
      { id: 'x2', label: 'Sorties', value: 140, max: 120 },
    ],
  },
  bar: {
    block: 'bar',
    title: 'Solde par compte',
    points: [
      { label: 'Compte courant', value: 1240 },
      { label: 'Épargne', value: 3800 },
      { label: 'Mobile money', value: 210 },
    ],
  },
  line: {
    block: 'line',
    title: 'Dépenses mois par mois',
    points: ['juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.'].map((label, at) => ({
      label,
      value: [620, 710, 980, 640, 760, 812][at],
    })),
  },
  breakdown: {
    block: 'breakdown',
    title: 'Dépenses par fonds',
    points: [
      { label: 'Courses', value: 320 },
      { label: 'Transport', value: 120 },
      { label: 'Sorties', value: 90 },
      { label: 'Autres', value: 60 },
    ],
  },
  funnel: {
    block: 'funnel',
    title: 'Où en sont mes offres',
    steps: [
      { name: 'nouvelles', count: 48 },
      { name: 'appréciées', count: 21 },
      { name: 'à postuler', count: 9 },
      { name: 'postulées', count: 6 },
      { name: 'entretien', count: 2 },
    ],
  },
  heatmap: {
    block: 'heatmap',
    title: 'Jours pointés',
    cells: Array.from({ length: 35 }, (_, at) => {
      const day = new Date(Date.now() - (34 - at) * 86_400_000).toISOString().slice(0, 10);
      return { day, done: (at * 7) % 3 !== 0 };
    }),
  },
  table: {
    block: 'table',
    title: 'Mouvements',
    columns: ['title', 'date', 'amount'],
    rows: [
      { title: 'Supermarché', date: '2026-11-14', amount: 82.4 },
      { title: 'Marché', date: '2026-11-16', amount: 35 },
    ],
    totalValue: 117.4,
  },
  datatable: {
    block: 'datatable',
    title: 'Offres à postuler',
    columns: ['company', 'location'],
    facets: ['location'],
    items: [
      { id: 'd1', title: 'ML engineer', values: { company: 'Doctolib', location: 'Paris' } },
      { id: 'd2', title: 'Data scientist', values: { company: 'Altereo', location: 'Lyon' } },
    ],
    actions: [
      { label: 'Postulée', set: {} },
      { label: 'Écarter', set: {} },
    ],
  },
  task_list: {
    block: 'task_list',
    title: 'À payer',
    items: [
      { id: 't1', title: 'Électricité', detail: '64 € · 23 nov.' },
      { id: 't2', title: 'Internet', detail: '30 € · 28 nov.' },
    ],
    actions: [{ label: '✓ Payée', set: {} }],
  },
  review: {
    block: 'review',
    title: 'Offres à décider',
    fields: ['company', 'location', 'note'],
    subtitle: ['company'],
    items: [
      {
        id: 'r1',
        title: 'ML engineer',
        values: {
          company: 'Doctolib',
          location: 'Paris',
          note: 'Équipe NLP, télétravail partiel.',
        },
      },
      {
        id: 'r2',
        title: 'Data scientist',
        values: { company: 'Altereo', location: 'Lyon', note: 'Eau et territoires.' },
      },
    ],
    actions: [
      { label: 'À postuler', set: {} },
      { label: 'Écarter', set: {} },
    ],
  },
  kanban: {
    block: 'kanban',
    title: 'Projets',
    by: 'status',
    columns: [
      { name: 'idée', items: [{ id: 'k1', title: 'Jardin partagé' }] },
      { name: 'en cours', items: [{ id: 'k2', title: 'Mémoire M1', badge: '60 %' }] },
      { name: 'fini', items: [] },
    ],
  },
  calendar: {
    block: 'calendar',
    title: 'Cette semaine',
    occurrences: [
      {
        id: 'c1',
        title: 'Entretien Doctolib',
        start: new Date(Date.now() + 86_400_000).toISOString(),
      },
      {
        id: 'c2',
        title: 'Cours de NLP',
        start: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      },
    ],
  },
  form: {
    block: 'form',
    title: 'Pointer',
    kind: 'CheckIn',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'note', label: 'Note', type: 'text' },
    ],
  },
  record: {
    block: 'record',
    title: 'Fiche',
    record: {
      id: 'x',
      kind: 'Account',
      title: 'Compte courant',
      fields: [
        { name: 'type', value: 'banque' },
        { name: 'balance', value: 1240 },
      ],
    },
  },
  sql: {
    block: 'sql',
    title: 'Requête',
    chart: 'bar',
    columns: ['mois', 'total'],
    rows: [
      { mois: 'oct.', total: 760 },
      { mois: 'nov.', total: 812 },
    ],
  },
};

/** The interface components, shown for real. */
function UiDemo({ id }: { id: string }) {
  const [seg, setSeg] = useState('mois');
  const [sel, setSel] = useState('');
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState('a');
  const confirm = useConfirm();
  const frame = (children: ReactNode) => (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4">{children}</div>
  );
  switch (id) {
    case 'segmented':
      return frame(
        <Segmented
          label="Période"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'semaine', label: 'Semaine' },
            { value: 'mois', label: 'Mois' },
            { value: 'annee', label: 'Année' },
          ]}
        />,
      );
    case 'select':
      return frame(
        <Select
          label="Compte"
          value={sel}
          placeholder="Choisir un compte"
          onChange={setSel}
          options={['Compte courant', 'Épargne', 'Mobile money', 'Espèces', 'Carte'].map((v) => ({
            value: v,
            label: v,
          }))}
          className="w-60"
        />,
      );
    case 'date':
      return frame(<DateInput label="Date" value={day} onChange={setDay} />);
    case 'dropzone':
      return frame(
        <DropZone
          className="w-full"
          onFiles={(files) =>
            toast(`${files.length} fichier(s) : dans l’exemple, rien n’est gardé.`)
          }
        />,
      );
    case 'tabs':
      return frame(
        <Tabs
          tabs={[
            { key: 'a', label: 'Compte' },
            { key: 'b', label: 'Espaces' },
            { key: 'c', label: 'Connexions' },
          ]}
          value={tab}
          onChange={setTab}
          label="Exemple"
        />,
      );
    case 'menu':
      return frame(
        <Menu
          trigger={<Button size="sm">⋯ Actions</Button>}
          align="start"
          items={[
            { label: 'Ouvrir', onSelect: () => toast('Ouvrir (exemple)') },
            { label: 'Mettre de côté', onSelect: () => toast('Mis de côté (exemple)') },
          ]}
        />,
      );
    case 'avatar':
      return frame(
        <>
          <Identity name="Awa Koné" who={{ kind: 'person', email: 'awa@doctolib.fr' }} size={40} />
          <Identity
            name="Doctolib"
            who={{ kind: 'organization', domain: 'doctolib.fr' }}
            size={40}
          />
          <Avatar name="Chasseur d’offres" size={40} tinted />
        </>,
      );
    case 'tag':
      return frame(
        <>
          <Tag tone="ok">connecté</Tag>
          <Tag tone="late">à vérifier</Tag>
          <Tag tone="error">en échec</Tag>
          <Tag tone="info">proposé</Tag>
          <Tag tone="neutral">en pause</Tag>
        </>,
      );
    case 'file_icon':
      return frame(
        <>
          {[
            ['application/pdf', 'a.pdf'],
            ['image/png', 'b.png'],
            ['text/csv', 'c.csv'],
            ['text/markdown', 'd.md'],
            ['audio/mpeg', 'e.mp3'],
            ['application/zip', 'f.zip'],
          ].map(([t, n]) => (
            <FileIcon key={n} mediaType={t!} name={n!} />
          ))}
        </>,
      );
    case 'markdown':
      return (
        <Markdown
          className="px-4 py-4"
          text={
            '## Mon mois\n\n> Une phrase mise en avant.\n\n| poste | montant |\n|---|---|\n| Loyer | 650 € |\n| Courses | 320 € |\n\n- [x] Payer le loyer\n- [ ] Relancer Doctolib — [site](https://example.org)'
          }
        />
      );
    case 'toast':
      return frame(
        <Button onClick={() => toast('Fait. Annulable depuis l’Activité.')}>
          Montrer un message
        </Button>,
      );
    case 'confirm':
      return frame(
        <>
          <Button
            onClick={() =>
              confirm.ask({
                title: 'Couper « Google Agenda » ?',
                lead: 'Ce qu’elle a apporté reste chez toi.',
                yes: 'Couper',
                danger: true,
                then: () => toast('Coupée (exemple).'),
              })
            }
          >
            Demander une confirmation
          </Button>
          {confirm.node}
        </>,
      );
    case 'empty':
      return <Empty title="Aucune connexion" lead="Relie un agenda ou ton Drive : à droite." />;
    default:
      return null;
  }
}

const UI_DEMOS = new Set([
  'segmented',
  'select',
  'date',
  'dropzone',
  'tabs',
  'menu',
  'avatar',
  'tag',
  'file_icon',
  'markdown',
  'toast',
  'confirm',
  'empty',
]);

/** Where a format or a view lives for real. */
const LIVE: Record<string, { to: string; label: string; schema: string }> = {
  list_detail: {
    to: '/personnes',
    label: 'Personnes',
    schema:
      '┌ liste ─┬─ fiche ──────┐\n│ ▸ Awa  │ Awa Koné     │\n│   Marc │ ✉ ☏  liens…  │\n└────────┴──────────────┘',
  },
  app_shell: {
    to: '/apps',
    label: 'Mes apps',
    schema:
      '┌ menu ──┬─ contenu ────┐\n│ Aperçu │ chiffres     │\n│ Pages  │ blocs…       │\n│ Données│              │\n└────────┴──────────────┘',
  },
  overview: {
    to: '/apps',
    label: 'une app › Aperçu',
    schema:
      '┌ 4 chiffres ──────────┐\n│ étapes │ à venir      │\n│ activité│ fichiers    │\n└───────────────────────┘',
  },
  dashboard: {
    to: '/apps',
    label: 'une app › ses pages',
    schema:
      '┌ filtres ─────────────┐\n│ ▢ ▢ ▢ ▢  (chiffres)   │\n│ ▤ bloc │ ▤ bloc       │\n│ ▤ bloc large          │\n└───────────────────────┘',
  },
  record_page: {
    to: '/personnes',
    label: 'une fiche',
    schema:
      '┌ en-tête ─────────────┐\n│ propriétés │ histoire │\n│ liens      │ fichiers │\n└───────────────────────┘',
  },
  cards: { to: '/personnes', label: 'Personnes › Cartes', schema: '▢ ▢ ▢\n▢ ▢' },
  timeline: { to: '/agenda', label: 'Agenda › Frise', schema: '━━━━   ━━━━━━\n   ━━━━━━━  ◆' },
  files: { to: '/documents', label: 'Documents', schema: '📄 📄 📄' },
  journal: { to: '/activite', label: 'Activité', schema: 'qui · quoi · quand · Annuler' },
  live: { to: '/apps', label: 'Candidatures › Suivi', schema: '{ code isolé }' },
  view: { to: '/apps', label: 'une app › Données', schema: 'une vue enregistrée' },
};

function Preview({ info }: { info: Info }) {
  if (DEMO[info.id] && BLOCK_RENDERS[info.id]) {
    const Render = BLOCK_RENDERS[info.id]!;
    return (
      <div className="pointer-events-auto">
        <Render
          block={DEMO[info.id]!}
          vocabulary={{}}
          refresh={() => toast('Dans l’exemple, rien n’est gardé.')}
        />
      </div>
    );
  }
  if (UI_DEMOS.has(info.id)) return <UiDemo id={info.id} />;
  const live = LIVE[info.id];
  if (live)
    return (
      <div className="grid gap-2 px-4 py-4">
        <pre className="overflow-x-auto font-mono text-[12px] leading-snug text-bark">
          {live.schema}
        </pre>
        <Link to={live.to} className="text-[13px] font-semibold text-primary hover:underline">
          Le voir en vrai : {live.label} →
        </Link>
      </div>
    );
  return <p className="px-4 py-4 text-[13px] text-bark">Pas d’aperçu.</p>;
}

type KindShape = {
  kind: string;
  count: number;
  /** Jarvis's own kinds (Model, Rule…): never offered to try a component on. */
  system?: boolean;
  facets?: { facet: string; start?: string; field?: string; target?: string; current?: string }[];
  model?: { fields?: { name: string; type: string; options?: string[] }[] };
};

/** A block's settings for one of her kinds, from its facets (the same rules Claude follows). */
function settingsFor(id: string, kind: KindShape): Record<string, unknown> | null {
  const facet = (name: string) => kind.facets?.find((f) => f.facet === name);
  const fields = (kind.model?.fields ?? []).filter(
    (f) => !['formula', 'lines', 'button', 'long_text'].includes(f.type),
  );
  const choice = facet('stages')?.field ?? fields.find((f) => f.type === 'choice')?.name;
  const options = kind.model?.fields?.find((f) => f.name === choice)?.options ?? [];
  const start = facet('dated')?.start;
  const k = kind.kind;
  switch (id) {
    case 'stat':
      return { block: 'stat', title: 'Combien', query: { kind: k, aggregate: { n: 'count()' } } };
    case 'bar':
    case 'breakdown':
      return choice
        ? {
            block: id,
            title: 'Par valeur',
            query: { kind: k, groupBy: choice, aggregate: { n: 'count()' } },
          }
        : null;
    case 'line':
      return start
        ? {
            block: 'line',
            title: 'Mois par mois',
            query: { kind: k, groupBy: `month(${start})`, aggregate: { n: 'count()' } },
          }
        : null;
    case 'funnel':
      return choice && options.length >= 2
        ? { block: 'funnel', title: 'Par étape', kind: k, by: choice, steps: options.slice(0, 8) }
        : null;
    case 'kanban':
      return choice ? { block: 'kanban', title: 'Par étape', kind: k, by: choice } : null;
    case 'gauge': {
      const m = facet('measurable');
      return m?.target
        ? { block: 'gauge', title: 'Avancement', kind: k, value: m.current ?? '0', max: m.target }
        : null;
    }
    case 'heatmap':
      return start ? { block: 'heatmap', title: 'Jours', kind: k, date: start, days: 35 } : null;
    case 'table':
      return {
        block: 'table',
        title: 'Entrées',
        query: { kind: k, fields: ['title', ...fields.slice(0, 3).map((f) => f.name)], limit: 20 },
      };
    case 'datatable':
      return {
        block: 'datatable',
        title: 'Entrées',
        kind: k,
        columns: fields
          .slice(0, 4)
          .map((f) => f.name)
          .concat(fields.length ? [] : ['title'])
          .slice(0, 4),
      };
    case 'review':
      return fields.length
        ? {
            block: 'review',
            title: 'Une à une',
            kind: k,
            fields: fields.slice(0, 6).map((f) => f.name),
          }
        : null;
    case 'calendar':
      return { block: 'calendar', title: 'Cette semaine', days: 7 };
    case 'form':
      return { block: 'form', title: 'Ajouter', kind: k };
    default:
      return null;
  }
}

function TryWithMine({ info }: { info: Info }) {
  const kindName = useKindName();
  const { data: kinds = [] } = useKinds();
  const needs = info.needs?.facets ?? [];
  const fit = (kinds as KindShape[]).filter(
    (one) =>
      one.count > 0 &&
      !one.system &&
      needs.every((n) => one.facets?.some((f) => f.facet === n)) &&
      settingsFor(info.id, one),
  );
  const [kind, setKind] = useState('');
  const tried = useMutation({
    mutationFn: (one: KindShape) =>
      api<{ blocks: Drawn[]; vocabulary: Vocabulary }>('/pages/try', {
        method: 'POST',
        body: { blocks: [settingsFor(info.id, one)] },
      }),
  });
  if (!fit.length)
    return <p className="text-[12.5px] text-faint">Aucun de tes types ne s’y prête encore.</p>;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          label="Un de tes types"
          value={kind}
          placeholder="Un de tes types"
          onChange={(value) => {
            setKind(value);
            const one = fit.find((k) => k.kind === value);
            if (one) tried.mutate(one);
          }}
          options={fit.map((one) => ({
            value: one.kind,
            label: `${kindName(one.kind)} (${one.count})`,
          }))}
          className="w-56"
        />
        {tried.isPending && <span className="text-[12.5px] text-bark">Calcul…</span>}
      </div>
      {tried.error && <p className="text-[12.5px] text-error">{(tried.error as Error).message}</p>}
      {tried.data?.blocks[0] && (
        <BlockView
          block={tried.data.blocks[0]}
          vocabulary={tried.data.vocabulary}
          refresh={() => tried.mutate(fit.find((k) => k.kind === kind)!)}
        />
      )}
    </div>
  );
}

function ComponentCard({ info }: { info: Info }) {
  const [trying, setTrying] = useState(false);
  const tryable =
    info.block &&
    [
      'stat',
      'bar',
      'breakdown',
      'line',
      'funnel',
      'kanban',
      'gauge',
      'heatmap',
      'table',
      'datatable',
      'review',
      'calendar',
      'form',
    ].includes(info.id);
  return (
    <Panel
      title={info.label.fr}
      action={
        <span className="flex flex-wrap gap-1">
          {info.block && (
            <Tag tone="info" dot={false}>
              bloc de page
            </Tag>
          )}
          {(info.needs?.facets ?? []).map((one) => (
            <Tag key={one} tone="neutral" dot={false}>
              {FACET_WORDS[one] ?? one}
            </Tag>
          ))}
        </span>
      }
    >
      <div className="border-b border-rule bg-paper">
        <Preview info={info} />
      </div>
      <div className="grid gap-2 px-4 py-3 text-[13px]">
        <p>{info.when}</p>
        <p className="text-[12.5px] text-bark">
          Ses noms :{' '}
          <span className="font-mono text-[12px]">{[info.id, ...info.aliases].join(' · ')}</span>
        </p>
        <p className="flex items-start gap-1.5 text-[12.5px] text-bark">
          <MessageSquareText size={14} className="mt-0.5 flex-none" />
          <span>
            À dire à Claude : « Dans ma page, ajoute : {info.label.fr.toLowerCase()} » — ou un de
            ses autres noms.
          </span>
        </p>
        {tryable &&
          (trying ? (
            <TryWithMine info={info} />
          ) : (
            <span>
              <Button size="sm" onClick={() => setTrying(true)}>
                <Play size={14} />
                Essayer avec mes données
              </Button>
            </span>
          ))}
      </div>
    </Panel>
  );
}

export function ComponentsCatalog() {
  const { data, isLoading } = useQuery({
    queryKey: ['components'],
    queryFn: () => api<Registry>('/components'),
  });
  const [category, setCategory] = useState('all');
  if (isLoading || !data) return <Skeleton className="h-40" />;
  const shown = data.components.filter((one) => category === 'all' || one.category === category);
  return (
    <>
      <CatalogCards />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Catégorie"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'Tous', n: data.components.length },
            ...data.categories
              .filter((c) => data.components.some((one) => one.category === c.id))
              .map((c) => ({
                value: c.id,
                label: c.fr,
                n: data.components.filter((one) => one.category === c.id).length,
              })),
          ]}
        />
      </div>
      {data.categories
        .filter((c) => shown.some((one) => one.category === c.id))
        .map((c) => (
          <section key={c.id} className="grid gap-3">
            <h2 className={cn('font-display text-[17px] font-semibold')}>{c.fr}</h2>
            <div className="grid items-start gap-4 xl:grid-cols-2">
              {shown
                .filter((one) => one.category === c.id)
                .map((one) => (
                  <ComponentCard key={one.id} info={one} />
                ))}
            </div>
          </section>
        ))}
    </>
  );
}
