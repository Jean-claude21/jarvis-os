import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronsUpDown, Hammer, Search, Settings } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Avatar, Dot, Menu, colorOf as nameColor, cn } from '../ui';
import { LIVE } from './nav';

interface MyApps {
  apps: { app: string; kinds: string[] }[];
}

const linkClass =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[14px] text-bark hover:bg-paper hover:text-ink min-w-0';
const activeClass = 'bg-paper text-ink font-medium shadow-card';

export function Sidebar({
  onSearch,
  onNavigate,
}: {
  onSearch: () => void;
  onNavigate?: () => void;
}) {
  const { me, space, choose, colorOf } = useSession();
  const { data } = useQuery({
    queryKey: ['apps', space.id],
    queryFn: () => api<MyApps>('/apps/mine'),
  });
  const spaceMenu = me.spaces.map((one) => ({
    label: (
      <span className="flex min-w-0 items-center gap-2">
        <Dot color={colorOf(one)} />
        <span className="truncate">{one.name}</span>
      </span>
    ),
    onSelect: () => choose(one.id),
  }));
  return (
    <nav className="flex h-full min-h-0 flex-col gap-1 p-3" aria-label="Navigation">
      {/* The space she looks at, at the top (and again at the bottom). */}
      <Menu
        align="start"
        items={spaceMenu}
        trigger={
          <button className="mb-1 flex w-full items-center gap-2.5 rounded-xl border border-rule bg-paper px-2.5 py-2 text-left shadow-card">
            <span
              className="grid h-8 w-8 flex-none place-items-center rounded-lg font-display text-sm font-bold text-white"
              style={{ background: colorOf(space) }}
            >
              {space.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate font-display text-[14px]">Jarvis</b>
              <span className="block truncate text-xs text-bark">{space.name}</span>
            </span>
            <ChevronsUpDown size={16} className="flex-none text-faint" />
          </button>
        }
      />
      <button
        onClick={onSearch}
        className="mb-2 flex items-center gap-2 rounded-lg border border-rule bg-paper px-2.5 py-2 text-left text-sm text-faint hover:text-ink"
      >
        <Search size={16} />
        <span className="flex-1 truncate">Chercher</span>
        <kbd className="rounded border border-rule px-1 font-mono text-[10px]">Ctrl K</kbd>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <p className="px-2.5 pt-1 pb-1 font-mono text-[10.5px] tracking-wider text-faint uppercase">
          Vivre
        </p>
        {LIVE.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={linkClass}
            activeProps={{ className: activeClass }}
            activeOptions={{ exact: to === '/' }}
          >
            <Icon size={17} className="flex-none" />
            <span className="truncate">{label}</span>
          </Link>
        ))}

        {data && data.apps.length > 0 && (
          <>
            <p className="px-2.5 pt-4 pb-1 font-mono text-[10.5px] tracking-wider text-faint uppercase">
              Apps
            </p>
            {data.apps.map((one) => (
              <Link
                key={one.app}
                to="/apps/$name"
                params={{ name: one.app }}
                onClick={onNavigate}
                className={linkClass}
                activeProps={{ className: activeClass }}
              >
                <span
                  className="grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] font-display text-[10px] font-bold text-white"
                  style={{ background: nameColor(one.app) }}
                >
                  {one.app.slice(0, 1)}
                </span>
                <span className="truncate">{one.app}</span>
              </Link>
            ))}
          </>
        )}

        <p className="px-2.5 pt-4 pb-1 font-mono text-[10.5px] tracking-wider text-faint uppercase">
          Espaces
        </p>
        {me.spaces.map((one) => (
          <button
            key={one.id}
            onClick={() => {
              choose(one.id);
              onNavigate?.();
            }}
            className={cn(linkClass, 'w-full text-left', one.id === space.id && activeClass)}
          >
            <Dot color={colorOf(one)} />
            <span className="truncate">{one.name}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-rule pt-2">
        <Link
          to="/atelier"
          onClick={onNavigate}
          className={linkClass}
          activeProps={{ className: activeClass }}
        >
          <Hammer size={17} />
          <span>Atelier</span>
        </Link>
        <Link
          to="/reglages"
          onClick={onNavigate}
          className={linkClass}
          activeProps={{ className: activeClass }}
        >
          <Settings size={17} />
          <span>Réglages</span>
        </Link>
        <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <Avatar name={me.person.name || me.person.email} size={28} />
          <span className="min-w-0">
            <b className="block truncate text-[13px]">{me.person.name}</b>
            <span className="block truncate text-xs text-faint">{me.person.email}</span>
          </span>
        </div>
      </div>
    </nav>
  );
}
