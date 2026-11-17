import { Link, Outlet, useMatches } from '@tanstack/react-router';
import { ChevronRight, Menu as MenuIcon, Search } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useLive } from '../lib/live';
import { Sheet, cn } from '../ui';
import { Palette } from './Palette';
import { Sidebar } from './Sidebar';

// The frame of every screen (v3 D17): the sidebar (a drawer on a phone), the top bar with the
// breadcrumb — each step a link, so back and forth work — and whether the screen is live.

export interface Crumb {
  label: string;
  to?: string;
  params?: Record<string, string>;
}

function Breadcrumb() {
  const matches = useMatches();
  const crumbs: Crumb[] = [];
  for (const match of matches) {
    const make = match.staticData?.crumbs;
    if (make) crumbs.push(...make(match.params as Record<string, string>));
  }
  return (
    <ol className="flex min-w-0 items-center gap-1 text-sm text-bark">
      {crumbs.map((crumb, at) => (
        <Fragment key={at}>
          {at > 0 && <ChevronRight size={14} className="flex-none text-faint" />}
          <li
            className={cn('min-w-0 truncate', at === crumbs.length - 1 && 'font-medium text-ink')}
          >
            {crumb.to && at < crumbs.length - 1 ? (
              <Link
                to={crumb.to}
                params={crumb.params ?? {}}
                className="hover:text-ink hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              crumb.label
            )}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

export function Shell() {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const live = useLive();
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-[256px] flex-none border-r border-rule lg:block">
        <Sidebar onSearch={() => setSearch(true)} />
      </aside>
      <Sheet open={menu} onOpenChange={setMenu} title="Jarvis" side="left">
        <Sidebar onSearch={() => setSearch(true)} onNavigate={() => setMenu(false)} />
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center gap-2 border-b border-rule bg-canvas/80 px-3 backdrop-blur md:px-6">
          <button
            className="rounded-lg p-2 text-bark hover:bg-paper lg:hidden"
            onClick={() => setMenu(true)}
            aria-label="Menu"
          >
            <MenuIcon size={19} />
          </button>
          <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1">
            <Breadcrumb />
          </nav>
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-1 font-mono text-[11px] sm:inline-flex',
              live === 'live' ? 'text-success' : 'text-faint',
            )}
            title={
              live === 'live'
                ? 'Les changements arrivent en direct'
                : 'Hors ligne : rechargement à la main'
            }
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                live === 'live' ? 'bg-success animate-pulse' : 'bg-faint',
              )}
            />
            {live === 'live' ? 'EN DIRECT' : live === 'connecting' ? 'CONNEXION' : 'HORS LIGNE'}
          </span>
          <button
            className="rounded-lg p-2 text-bark hover:bg-paper"
            onClick={() => setSearch(true)}
            aria-label="Chercher"
          >
            <Search size={18} />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-6 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <Palette open={search} setOpen={setSearch} />
    </div>
  );
}
