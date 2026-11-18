import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { Activity, type ActivitySearch } from './routes/Activity';
import { AppPage, Apps, type AppTab } from './routes/Apps';
import {
  AgendaPage,
  DocumentsPage,
  GoalsPage,
  MoneyPage,
  PeoplePage,
  TasksPage,
} from './routes/Across';
import { QueuePage } from './routes/Queue';
import { viewSearch, type ViewSearch } from './engine/types';
import { EntryPage } from './routes/Entry';
import { AgentPage, AtelierPage, atelierSearch } from './routes/Atelier';
import { SettingsPage, settingsSearch } from './routes/Settings';
import { Today } from './routes/Today';
import { ComposePage } from './routes/PageCompose';
import { BilansPage } from './routes/Bilans';
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
      ...(search.t === 'overview' ||
      search.t === 'activity' ||
      search.t === 'data' ||
      (typeof search.t === 'string' && /^page:[\w-]{4,64}$/.test(search.t))
        ? { t: search.t as AppTab }
        : {}),
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
  viewPage('/argent', 'Argent', MoneyPage),
  viewPage('/objectifs', 'Objectifs', GoalsPage),
  page('/a-valider', 'À valider', QueuePage),
  // Her bilans (v3 F4): pages of the « Revue » format, outside any app.
  createRoute({
    getParentRoute: () => root,
    path: '/bilans',
    component: BilansPage,
    validateSearch: (search: Record<string, unknown>): ViewSearch & { page?: string } => ({
      ...viewSearch(search),
      ...(typeof search.page === 'string' && search.page.length < 80 ? { page: search.page } : {}),
    }),
    staticData: { crumbs: () => [{ label: 'Bilans', to: '/bilans' }] },
  }),
  // A page made or changed on screen (v3 F4), for an app or for her.
  createRoute({
    getParentRoute: () => root,
    path: '/composer',
    component: ComposePage,
    validateSearch: (
      search: Record<string, unknown>,
    ): { page?: string; app?: string; format?: string } => {
      const text = (value: unknown) =>
        typeof value === 'string' && value.length < 120 ? value : undefined;
      const out: { page?: string; app?: string; format?: string } = {};
      for (const key of ['page', 'app', 'format'] as const) {
        const value = text(search[key]);
        if (value) out[key] = value;
      }
      return out;
    },
    staticData: { crumbs: () => [{ label: 'Composer une page' }] },
  }),
  // « Atelier » became « Construire » (v3 F1): the old addresses still lead there.
  createRoute({
    getParentRoute: () => root,
    path: '/atelier',
    beforeLoad: ({ search }) => {
      throw redirect({ to: '/construire', search: search as never });
    },
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/construire',
    component: AtelierPage,
    validateSearch: atelierSearch,
    staticData: { crumbs: () => [{ label: 'Construire', to: '/construire' }] },
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/construire/agents/$name',
    component: AgentPage,
    staticData: {
      crumbs: (params) => [
        { label: 'Construire', to: '/construire' },
        { label: params.name ?? '' },
      ],
    },
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/reglages',
    component: SettingsPage,
    validateSearch: settingsSearch,
    staticData: { crumbs: () => [{ label: 'Réglages', to: '/reglages' }] },
  }),
];

export const router = createRouter({
  routeTree: root.addChildren(routes),
  basepath: '/v3',
  defaultPreload: 'intent',
});
