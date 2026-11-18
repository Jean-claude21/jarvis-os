import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronsUpDown, Hammer, Plus, Search, Settings } from 'lucide-react';
import { openFollow } from '../routes/Follow';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useKinds } from '../lib/kinds';
import { useSession } from '../lib/session';
import { AppIcon, Avatar, Caps, Menu, SpaceDot, cn } from '../ui';
import { ACROSS, APPS, BILANS, QUEUE, TODAY } from './nav';
import { useQueue } from '../routes/Queue';

// The sidebar, as J-C's design system draws it: on the canvas, the space switcher on top, the
// search, the groups in mono capitals, the current item lifted on paper, her account at the bottom.

interface MyApps {
  apps: { app: string; kinds: string[] }[];
}

const item =
  'flex w-full min-w-0 items-center gap-2.5 rounded-[2px] border border-transparent px-2 py-[7px] text-left text-[14px] no-underline hover:bg-paper/55';
const current = 'border-rule bg-paper font-semibold shadow-card';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Caps className="px-2 pt-1.5 pb-1 text-faint">{label}</Caps>
      {children}
    </div>
  );
}

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
  // The views across her life: only those some kind she keeps has the facet of (v3 R7).
  const { data: kinds } = useKinds();
  const has = new Set(
    (kinds ?? [])
      .filter((one) => one.count > 0)
      .flatMap((one) => (one.facets ?? []).map((facet) => facet.facet)),
  );
  const across = [...ACROSS.filter((one) => has.has(one.facet)), BILANS];
  // What waits for her now: the red count on « Aujourd'hui ».
  const { data: now } = useQuery({
    queryKey: ['now'],
    queryFn: () => api<{ items: { group: string }[] }>('/now'),
  });
  // Two counts, two meanings: what slips today (late, to fix) on « Aujourd'hui », what waits for
  // her yes on « À valider ».
  const slipping = (now?.items ?? []).filter((one) => ['fix', 'late'].includes(one.group)).length;
  const { data: queue = [] } = useQueue();
  const spaceMenu = me.spaces.map((one) => ({
    label: (
      <span className="flex min-w-0 items-center gap-2">
        <SpaceDot color={colorOf(one)} />
        <span className="truncate">{one.name}</span>
      </span>
    ),
    onSelect: () => choose(one.id),
  }));
  return (
    <nav className="flex h-full min-h-0 flex-col gap-3.5 py-1 pr-3 pl-1" aria-label="Navigation">
      <Menu
        align="start"
        items={spaceMenu}
        trigger={
          <button className="flex w-full items-center gap-2.5 rounded-[2px] border border-rule bg-paper px-2.5 py-[9px] text-left">
            <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[2px] bg-primary font-display text-[15px] font-bold text-on-primary">
              J
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate font-display text-[14px] leading-tight font-semibold">
                Jarvis OS
              </b>
              <small className="block truncate text-xs text-bark">{space.name}</small>
            </span>
            <ChevronsUpDown size={16} className="flex-none text-faint" />
          </button>
        }
      />
      <button
        onClick={onSearch}
        className="flex items-center gap-2 rounded-[2px] border border-rule bg-paper px-2.5 py-[7px] text-left text-faint"
      >
        <Search size={16} />
        <span className="flex-1 truncate">Chercher ou noter</span>
        <kbd className="rounded-[2px] border border-rule px-[5px] py-[3px] font-mono text-[11px] leading-none text-bark">
          Ctrl K
        </kbd>
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto">
        <Link
          to={TODAY.to}
          onClick={onNavigate}
          className={item}
          activeProps={{ className: current }}
          activeOptions={{ exact: true }}
        >
          <TODAY.icon size={16} className="flex-none" />
          <span className="flex-1 truncate">{TODAY.label}</span>
          {slipping > 0 && (
            <span
              className="rounded-[2px] bg-primary px-1.5 py-[3px] font-mono text-[11px] leading-none text-on-primary"
              title="En retard ou à régler"
            >
              {slipping}
            </span>
          )}
        </Link>
        <Link
          to={QUEUE.to}
          onClick={onNavigate}
          className={item}
          activeProps={{ className: current }}
        >
          <QUEUE.icon size={16} className="flex-none" />
          <span className="flex-1 truncate">{QUEUE.label}</span>
          {queue.length > 0 && (
            <span
              className="rounded-[2px] bg-ochre px-1.5 py-[3px] font-mono text-[11px] leading-none text-on-primary"
              title="Attend ton oui"
            >
              {queue.length}
            </span>
          )}
        </Link>

        {across.length > 0 && (
          <Group label="Ma vie">
            {across.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                className={item}
                activeProps={{ className: current }}
              >
                <Icon size={16} className="flex-none" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </Group>
        )}

        <Group label="Mes apps">
          {(data?.apps ?? []).map((one) => (
            <Link
              key={one.app}
              to="/apps/$name"
              params={{ name: one.app }}
              onClick={onNavigate}
              className={item}
              activeProps={{ className: current }}
            >
              <AppIcon name={one.app} />
              <span className="truncate">{one.app}</span>
            </Link>
          ))}
          <Link
            to={APPS.to}
            onClick={onNavigate}
            className={cn(item, 'border-dashed border-rule-strong text-faint')}
            activeProps={{ className: current }}
            activeOptions={{ exact: true }}
          >
            <APPS.icon size={16} className="flex-none" />
            <span className="truncate">{APPS.label}</span>
          </Link>
          <button
            onClick={() => {
              onNavigate?.();
              openFollow();
            }}
            className={cn(item, 'cursor-pointer text-faint hover:text-ink')}
          >
            <Plus size={16} className="flex-none" />
            <span className="truncate">Suivre quelque chose</span>
          </button>
        </Group>

        <Group label="Espaces">
          {me.spaces.map((one) => (
            <button
              key={one.id}
              onClick={() => {
                choose(one.id);
                onNavigate?.();
              }}
              className={cn(item, one.id === space.id && current)}
            >
              <SpaceDot color={colorOf(one)} className="mx-1.5" />
              <span className="truncate">{one.name}</span>
            </button>
          ))}
        </Group>
      </div>

      <div className="flex flex-col gap-0.5">
        <Link
          to="/construire"
          onClick={onNavigate}
          className={item}
          activeProps={{ className: current }}
        >
          <Hammer size={16} />
          <span>Construire</span>
        </Link>
        <Link
          to="/reglages"
          onClick={onNavigate}
          className={item}
          activeProps={{ className: current }}
        >
          <Settings size={16} />
          <span>Réglages</span>
        </Link>
      </div>
      <div className="flex items-center gap-2.5 rounded-[2px] border border-rule bg-paper px-2.5 py-[9px]">
        <Avatar name={me.person.name || me.person.email} />
        <span className="min-w-0">
          <b className="block truncate text-[13px] leading-tight font-semibold">{me.person.name}</b>
          <small className="block truncate text-xs text-bark">{me.person.email}</small>
        </span>
      </div>
    </nav>
  );
}
