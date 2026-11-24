import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { CardsEditor, type Card } from '../blocks/Cards';
import { api } from '../lib/api';
import { Button, Empty, PageHead, Panel, Skeleton, Tabs, inputClass } from '../ui';
import { toast } from '../ui/more';
import { PageView } from './Apps';

// Her dashboards (spec 107): pages of cards outside any app, across her whole life — each a tab,
// made on the spot. An app's own pages stay in the app; these mix the cards of all of them.

interface PageRow {
  id: string;
  title: string;
  app: string | null;
  format: 'dashboard' | 'review';
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

export function DashboardsPage() {
  const search = useSearch({ from: '/tableaux' });
  const navigate = useNavigate();
  const client = useQueryClient();
  const pages = useQuery({
    queryKey: ['pages', 'dashboards'],
    queryFn: () => api<PageRow[]>('/pages'),
  });
  const mine = (pages.data ?? []).filter((one) => !one.app && one.format === 'dashboard');
  const open = mine.find((one) => one.id === search.d) ?? mine[0];
  const choose = (id: string) => void navigate({ to: '/tableaux', search: { d: id } });
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
      choose(id);
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
  return (
    <>
      <PageHead
        title="Tableaux de bord"
        lead="Tes chiffres, graphiques et listes de toutes tes apps, réunis où tu veux."
        actions={actions}
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
            if (saved && id) choose(id);
          }}
        />
      ) : pages.isLoading ? (
        <Skeleton className="h-60" />
      ) : !open ? (
        <Panel>
          <Empty
            title="Aucun tableau de bord pour l’instant"
            lead="Compose ta vue d’ensemble en un geste, ou crée un tableau et pose-y les cartes de tes apps."
          />
          <div className="flex justify-center pb-5">{actions}</div>
        </Panel>
      ) : (
        <>
          <Tabs
            label="Tes tableaux de bord"
            value={open.id}
            onChange={choose}
            tabs={mine.map((one) => ({ key: one.id, label: one.label?.fr ?? one.title }))}
          />
          <PageView key={open.id} id={open.id} />
        </>
      )}
    </>
  );
}
