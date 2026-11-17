import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Activity, type ActivitySearch } from './routes/Activity';
import { AppPage, Apps, type AppTab } from './routes/Apps';
import { AgendaPage, DocumentsPage, PeoplePage, TasksPage } from './routes/Across';
import { viewSearch, type ViewSearch } from './engine/types';
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

/** A page that shows a view: its state (render, search, filters, sort, groups) in the URL. */
const viewPage = <P extends string>(path: P, label: string, component: () => React.ReactNode) =>
  createRoute({
    getParentRoute: () => root,
    path,
    component,
    validateSearch: viewSearch,
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
    validateSearch: (search: Record<string, unknown>): ViewSearch & { t?: AppTab | undefined } => ({
      ...viewSearch(search),
      ...(search.t === 'overview' || search.t === 'activity' ? { t: search.t } : {}),
    }),
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
  viewPage('/agenda', 'Agenda', AgendaPage),
  viewPage('/taches', 'Tâches', TasksPage),
  viewPage('/documents', 'Documents', DocumentsPage),
  viewPage('/personnes', 'Personnes', PeoplePage),
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
