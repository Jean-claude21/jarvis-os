import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Activity, type ActivitySearch } from './routes/Activity';
import { AppPage, Apps } from './routes/Apps';
import { EntryPage } from './routes/Entry';
import { Soon } from './routes/Soon';
import { Today } from './routes/Today';
import { Shell, type Crumb } from './shell/Shell';

// The screens (v3 D17): the URL holds where she is, so back and forth and the breadcrumb work.

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    crumbs?: (params: Record<string, string>) => Crumb[];
  }
  interface Register {
    router: typeof router;
  }
}

const root = createRootRoute({ component: Shell });
const page = <P extends string>(path: P, label: string, component: () => React.ReactNode) =>
  createRoute({
    getParentRoute: () => root,
    path,
    component,
    staticData: { crumbs: () => [{ label, to: path }] },
  });

const routes = [
  page('/', 'Aujourd’hui', Today),
  createRoute({
    getParentRoute: () => root,
    path: '/activite',
    component: Activity,
    // Who, what, when: kept in the URL, so a filtered view can be opened again or shared.
    validateSearch: (search: Record<string, unknown>): ActivitySearch => {
      const pick = <T extends string>(value: unknown, allowed: readonly T[]) =>
        allowed.includes(value as T) ? (value as T) : undefined;
      const author = pick(search.author, ['all', 'me', 'assistant', 'auto', 'telegram'] as const);
      const action = pick(search.action, ['all', 'create', 'update', 'archive', 'link'] as const);
      const period = pick(search.period, ['today', '7', '30', 'all'] as const);
      return {
        ...(author ? { author } : {}),
        ...(action ? { action } : {}),
        ...(period ? { period } : {}),
      };
    },
    staticData: { crumbs: () => [{ label: 'Activité', to: '/activite' }] },
  }),
  page('/apps', 'Mes apps', Apps),
  createRoute({
    getParentRoute: () => root,
    path: '/apps/$name',
    component: AppPage,
    staticData: {
      crumbs: (params) => [{ label: 'Mes apps', to: '/apps' }, { label: params.name ?? '' }],
    },
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/entree/$id',
    component: EntryPage,
    staticData: { crumbs: () => [{ label: 'Entrée' }] },
  }),
  page('/agenda', 'Agenda', () => (
    <Soon
      title="Agenda"
      lead="Tout ce qui est daté, dans toutes tes apps : ta semaine et ton mois."
      step="le moteur de vues (V5)"
    />
  )),
  page('/documents', 'Documents', () => (
    <Soon
      title="Documents"
      lead="Tous tes documents et fichiers, dans toutes tes apps : lus, rangés et reliés."
      step="les Documents vivants (V7)"
    />
  )),
  page('/personnes', 'Personnes', () => (
    <Soon
      title="Personnes"
      lead="Toutes les personnes et organisations de ta vie, et leurs cercles."
      step="les Personnes (V7)"
    />
  )),
  page('/taches', 'Tâches', () => (
    <Soon
      title="Tâches"
      lead="Tout ce qui est à faire, dans toutes tes apps."
      step="le moteur de vues (V5)"
    />
  )),
  page('/atelier', 'Atelier', () => (
    <Soon
      title="Atelier"
      lead="Types, skills, agents et connexions : pour construire."
      step="les agents (V8)"
    />
  )),
  page('/reglages', 'Réglages', () => (
    <Soon title="Réglages" lead="Ton compte, tes espaces, leurs membres." step="V7" />
  )),
];

export const router = createRouter({
  routeTree: root.addChildren(routes),
  basepath: '/v3',
  defaultPreload: 'intent',
});
