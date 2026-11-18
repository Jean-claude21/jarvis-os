import { Link, Outlet, useMatches, useNavigate } from '@tanstack/react-router';
import { ChevronRight, History, Menu as MenuIcon, Search } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { useLive } from '../lib/live';
import { DropLayer } from '../lib/upload';
import { Toaster } from '../ui/more';
import { IconButton, Sheet, cn } from '../ui';
import { Palette } from './Palette';
import { Sidebar } from './Sidebar';

// The frame, as J-C's design system draws it: the sidebar on the canvas; the page on a paper sheet
// (12px from the edges, ruled, shadowed); in its top bar the breadcrumb (each step a link: back and
// forth work), the « now » pill whose dot says the screen is live, and the bordered icon buttons.

export interface Crumb {
  label: string;
  to?: string;
  params?: Record<string, string>;
}

function Breadcrumb() {
  const matches = useMatches();
  const crumbs: Crumb[] = [{ label: 'Jarvis OS', to: '/' }];
  for (const match of matches) {
    const make = match.staticData?.crumbs;
    if (make) crumbs.push(...make(match.params as Record<string, string>));
  }
  return (
    <ol className="flex min-w-0 items-center gap-2 text-[13px] text-bark">
      {crumbs.map((crumb, at) => {
        const last = at === crumbs.length - 1;
        return (
          <Fragment key={at}>
            {at > 0 && (
              <ChevronRight
                size={13}
                className={cn('flex-none text-faint', at === 1 && 'hidden sm:block')}
              />
            )}
            <li
              className={cn(
                'min-w-0 truncate',
                last && 'font-semibold whitespace-nowrap text-ink',
                at === 0 && 'hidden sm:block',
              )}
            >
              {crumb.to && !last ? (
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
        );
      })}
    </ol>
  );
}

/** « MAR 17 NOV · 16:20 », kept to the minute. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const day = now
    .toLocaleDateString('fr', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .toUpperCase();
  const time = now.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
  return { day, time };
}

export function Shell() {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const live = useLive();
  const clock = useClock();
  const navigate = useNavigate();
  return (
    <div className="grid h-dvh grid-cols-1 md:grid-cols-[252px_minmax(0,1fr)] md:p-3">
      <aside className="hidden min-h-0 md:block">
        <Sidebar onSearch={() => setSearch(true)} />
      </aside>
      <Sheet open={menu} onOpenChange={setMenu} title="Navigation" side="left">
        <div className="h-full p-3">
          <Sidebar onSearch={() => setSearch(true)} onNavigate={() => setMenu(false)} />
        </div>
      </Sheet>
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-paper md:rounded-[2px] md:border md:border-rule md:shadow-card">
        <header className="flex flex-none items-center gap-2.5 border-b border-rule px-4 py-2.5">
          <IconButton className="md:hidden" onClick={() => setMenu(true)} aria-label="Menu">
            <MenuIcon size={16} />
          </IconButton>
          <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1">
            <Breadcrumb />
          </nav>
          <span
            className="hidden items-center gap-2 rounded-full border border-rule bg-sand px-2.5 py-[5px] font-mono text-[11.5px] whitespace-nowrap sm:inline-flex"
            title={live === 'live' ? 'En direct : les changements arrivent seuls' : 'Hors ligne'}
          >
            <span
              className={cn(
                'h-[7px] w-[7px] flex-none rounded-full',
                live === 'live'
                  ? 'bg-success shadow-[0_0_0_3px_var(--success-surface)]'
                  : 'bg-faint',
              )}
            />
            {clock.day} · {clock.time}
          </span>
          <IconButton onClick={() => setSearch(true)} aria-label="Chercher">
            <Search size={16} />
          </IconButton>
          <IconButton
            onClick={() => void navigate({ to: '/activite' })}
            aria-label="Activité"
            title="Activité : qui a fait quoi"
          >
            <History size={16} />
          </IconButton>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 overflow-y-auto px-4 pt-5 pb-7 md:px-6">
          <Outlet />
        </div>
      </main>
      <Palette open={search} setOpen={setSearch} />
      <DropLayer />
      <Toaster />
    </div>
  );
}
