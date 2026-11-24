import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, LayoutDashboard, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CardsEditor, type Card } from '../blocks/Cards';
import { api } from '../lib/api';
import { AppIcon, Button, Empty, IconButton, PageHead, Panel, Skeleton, inputClass } from '../ui';
import { toast, useConfirm } from '../ui/more';
import { PageView } from './Apps';

// Her dashboards (spec 107): every one of them listed first — hers, which mix the cards of all her
// apps, then those of each app — one gesture opens it, one deletes it (archived: the Activity gives
// it back). An app's own pages open in the app.

interface PageRow {
  id: string;
  title: string;
  app: string | null;
  format: 'dashboard' | 'review';
  cards: number;
  label: { fr?: string } | null;
}

/** « Ma vue d'ensemble »: of each app, its first figures, then one chart or list. */
export function overviewOf(cards: Card[]): Card['block'][] {
  const byApp = new Map<string, Card[]>();
  for (const card of cards) {
    if (card.from === null) continue;
    const key = card.app ?? '';
    byApp.set(key, [...(byApp.get(key) ?? []), card]);
  }
  const blocks: Card['block'][] = [];
  for (const group of byApp.values()) {
    blocks.push(
      ...group
        .filter((one) => one.family === 'figure')
        .slice(0, 2)
        .map((one) => one.block),
    );
    const more = group.find((one) => one.family === 'chart' || one.family === 'list');
    if (more) blocks.push(more.block);
  }
  return blocks.slice(0, 16);
}

const nameOf = (one: PageRow) => one.label?.fr ?? one.title;

export function DashboardsPage() {
  const search = useSearch({ from: '/tableaux' });
  const navigate = useNavigate();
  const client = useQueryClient();
  const confirm = useConfirm();
  const pages = useQuery({
    queryKey: ['pages', 'dashboards'],
    queryFn: () => api<PageRow[]>('/pages'),
  });
  const all = (pages.data ?? []).filter((one) => one.format === 'dashboard');
  const mine = all.filter((one) => !one.app);
  const inApps = all.filter((one) => one.app);
  const open = search.d ? mine.find((one) => one.id === search.d) : undefined;
  const openOne = (id: string) => void navigate({ to: '/tableaux', search: { d: id } });
  const toAll = () => void navigate({ to: '/tableaux', search: {} });
  const choose = (one: PageRow) =>
    one.app
      ? void navigate({
          to: '/apps/$name',
          params: { name: one.app },
          search: { t: `page:${one.id}` },
        })
      : openOne(one.id);

  // Deleted = archived: her data stays, the Activity gives the dashboard back in one gesture.
  const remove = useMutation({
    mutationFn: async (one: PageRow) => {
      await api(`/entries/${one.id}/archive`, { method: 'POST', body: {} });
      return one;
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: (one) => {
      toast(`« ${nameOf(one)} » est supprimé. L’Activité le rend d’un geste.`);
      void client.invalidateQueries({ queryKey: ['pages'] });
      void client.invalidateQueries({ queryKey: ['history'] });
      if (search.d === one.id) toAll();
    },
  });
  const askRemove = (one: PageRow) =>
    confirm.ask({
      title: `Supprimer « ${nameOf(one)} » ?`,
      lead: one.app
        ? `C’est une page de l’app ${one.app}. Tes données restent ; l’Activité la rend d’un geste.`
        : 'Tes données restent ; seules ses cartes partent. L’Activité le rend d’un geste.',
      yes: 'Supprimer',
      danger: true,
      then: () => remove.mutate(one),
    });

  // A new one: its name, then its cards, kept when she saves.
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [making, setMaking] = useState<string | null>(null);
  const overview = useMutation({
    mutationFn: async () => {
      const blocks = overviewOf(await api<Card[]>('/cards'));
      if (!blocks.length)
        throw new Error('Installe une app d’abord : ses cartes composeront ta vue d’ensemble.');
      const saved = await api<{ entries: { id: string }[] }>('/save', {
        method: 'POST',
        body: { entries: [{ kind: 'Page', title: 'Vue d’ensemble', data: { blocks } }] },
      });
      return saved.entries[0]!.id;
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: (id) => {
      toast('Ta vue d’ensemble est prête : « Modifier » pour l’ajuster.');
      void client.invalidateQueries({ queryKey: ['pages'] });
      openOne(id);
    },
  });
  const start = () => {
    if (!name.trim()) return toast('Donne un nom au tableau de bord.', 'error');
    setMaking(name.trim());
    setNaming(false);
    setName('');
  };
  const actions = (
    <span className="flex flex-wrap gap-2">
      <Button onClick={() => overview.mutate()} disabled={overview.isPending}>
        <Sparkles size={15} />
        Ma vue d’ensemble
      </Button>
      <Button tone="solid" onClick={() => setNaming(true)}>
        <Plus size={15} />
        Nouveau tableau de bord
      </Button>
    </span>
  );
  const tile = (one: PageRow) => (
    <li
      key={one.id}
      className="flex items-center gap-3 rounded-[12px] border border-rule bg-paper px-4 py-3 hover:border-rule-strong"
    >
      <button
        onClick={() => choose(one)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        {one.app ? (
          <AppIcon name={one.app} size={28} />
        ) : (
          <LayoutDashboard size={22} aria-hidden className="flex-none text-bark" />
        )}
        <span className="min-w-0">
          <b className="block truncate text-[14px]">{nameOf(one)}</b>
          <span className="block truncate text-[12.5px] text-bark">
            {one.app ?? 'Toutes tes apps'} · {one.cards} carte{one.cards > 1 ? 's' : ''}
          </span>
        </span>
      </button>
      <IconButton aria-label={`Supprimer « ${nameOf(one)} »`} onClick={() => askRemove(one)}>
        <Trash2 size={15} />
      </IconButton>
    </li>
  );

  return (
    <>
      <PageHead
        title={open ? nameOf(open) : 'Tableaux de bord'}
        lead={
          open
            ? 'Un de tes tableaux de bord : « Modifier » pour changer ses cartes.'
            : 'Tous tes tableaux de bord : les tiens, qui réunissent tes apps, et ceux de chaque app.'
        }
        actions={
          open ? (
            <span className="flex flex-wrap gap-2">
              <Button onClick={toAll}>
                <ArrowLeft size={15} />
                Tous les tableaux
              </Button>
              <Button tone="quiet" onClick={() => askRemove(open)}>
                <Trash2 size={15} />
                Supprimer
              </Button>
            </span>
          ) : (
            actions
          )
        }
      />
      {naming && (
        <Panel title="Nouveau tableau de bord">
          <form
            className="flex flex-wrap items-center gap-2 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              start();
            }}
          >
            <input
              autoFocus
              aria-label="Nom du tableau de bord"
              placeholder="Mon mois, Ma maison, Ma santé…"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass.replace('w-full', 'w-72 max-w-full')}
            />
            <Button tone="solid" type="submit">
              Continuer
            </Button>
            <Button tone="quiet" type="button" onClick={() => setNaming(false)}>
              Annuler
            </Button>
          </form>
        </Panel>
      )}
      {making ? (
        <CardsEditor
          page={null}
          place={{}}
          title={making}
          onDone={(saved, id) => {
            setMaking(null);
            if (saved && id) openOne(id);
          }}
        />
      ) : pages.isLoading ? (
        <Skeleton className="h-60" />
      ) : open ? (
        <PageView key={open.id} id={open.id} />
      ) : !all.length ? (
        <Panel>
          <Empty
            title="Aucun tableau de bord pour l’instant"
            lead="Compose ta vue d’ensemble en un geste, ou crée un tableau et pose-y les cartes de tes apps."
          />
          <div className="flex justify-center pb-5">{actions}</div>
        </Panel>
      ) : (
        <>
          <section aria-label="Mes tableaux de bord" className="grid gap-2">
            <h2 className="font-display text-[15px] font-semibold">Mes tableaux de bord</h2>
            {mine.length ? (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{mine.map(tile)}</ul>
            ) : (
              <p className="text-[13px] text-bark">
                Aucun encore : « Ma vue d’ensemble » en compose un en un geste.
              </p>
            )}
          </section>
          {inApps.length > 0 && (
            <section aria-label="Dans mes apps" className="grid gap-2">
              <h2 className="font-display text-[15px] font-semibold">Dans mes apps</h2>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inApps.map(tile)}</ul>
            </section>
          )}
        </>
      )}
      {confirm.node}
    </>
  );
}
