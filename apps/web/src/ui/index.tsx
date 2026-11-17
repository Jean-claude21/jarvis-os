import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { clsx, type ClassValue } from 'clsx';
import { X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// The primitives (v3 D17), drawn exactly as J-C's design system (the v2 client, from his mockup):
// 2px corners, panels with a sand head and a paper body, mono tags with a dot, Archivo titles,
// bordered icon buttons. Never a coloured border on the left of anything: a dot or a tint.

export const cn = (...values: ClassValue[]) => clsx(values);

/** Mono capitals: the labels of groups and sections. */
export const Caps = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      'font-mono text-[11px] leading-[1.4] font-medium tracking-[0.06em] text-bark uppercase',
      className,
    )}
  >
    {children}
  </span>
);

type Tone = 'plain' | 'solid' | 'quiet' | 'danger';
export function Button({
  tone = 'plain',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[2px] font-semibold whitespace-nowrap disabled:opacity-50',
        size === 'sm' ? 'px-[9px] py-[5px] text-[12.5px]' : 'px-3 py-2 text-[13px]',
        tone === 'solid' &&
          'border border-ink bg-ink text-paper hover:border-primary-strong hover:bg-primary-strong',
        tone === 'plain' && 'border border-rule-strong bg-paper text-ink hover:bg-sand',
        tone === 'quiet' && 'border border-transparent text-bark hover:bg-sand hover:text-ink',
        tone === 'danger' && 'border border-error bg-error text-paper',
        className,
      )}
    />
  );
}

/** A bordered 32px square with an icon (the top bar's buttons); a pip says something is new. */
export function IconButton({
  children,
  pip,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pip?: boolean }) {
  return (
    <button
      {...rest}
      className={cn(
        'relative grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-[2px] border border-rule bg-paper text-ink hover:bg-sand',
        className,
      )}
    >
      {children}
      {pip && (
        <span className="absolute top-[5px] right-[5px] h-[7px] w-[7px] rounded-full border-[1.5px] border-paper bg-primary" />
      )}
    </button>
  );
}

export type TagTone = 'neutral' | 'info' | 'ok' | 'late' | 'error' | 'plain';
/** A state, in mono with its dot: « à postuler », « en retard ». */
export function Tag({
  children,
  tone = 'neutral',
  dot = true,
  className,
}: {
  children: ReactNode;
  tone?: TagTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded-[2px] px-[7px] py-[2px] font-mono text-[11.5px] leading-[1.4] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-clay text-bark',
        tone === 'info' && 'bg-info-surface text-info',
        tone === 'ok' && 'bg-success-surface text-success',
        tone === 'late' && 'bg-verify-surface text-verify',
        tone === 'error' && 'bg-error-surface text-error',
        tone === 'plain' && 'pl-0 text-bark',
        className,
      )}
    >
      {dot && tone !== 'plain' && (
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

/** The blue mono badge beside a title (« 6 type(s) »). */
export const Built = ({ children }: { children: ReactNode }) => (
  <span className="ml-1 inline-flex items-center gap-1.5 rounded-[2px] bg-info-surface px-[7px] py-[2px] align-[3px] font-mono text-[11px] leading-[1.4] font-medium text-info">
    {children}
  </span>
);

/** A stable colour for a name: the same app or person, the same colour, every time. */
const PALETTE = ['#b83a1b', '#2f6f5e', '#4a5fa8', '#8a5a9e', '#a8862a', '#3b8ea5', '#9e4a5a'];
export const colorOf = (name: string) => {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
};
export const initialsOf = (name: string) =>
  name
    .replace(/[^\p{L}\p{N}\s@._-]/gu, '')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((word) => word[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

/** A person or an author: a round avatar on clay (or a colour), initials in Archivo. */
export function Avatar({
  name,
  src,
  size = 30,
  tinted = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  tinted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid flex-none place-items-center overflow-hidden rounded-full font-display font-semibold',
        tinted ? 'text-white' : 'bg-clay text-ink',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        ...(tinted ? { background: colorOf(name) } : {}),
      }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

/** An app's square mark: its colour and its initial. */
export function AppIcon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-[2px] font-display font-bold text-[#fffdf9]"
      style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.5 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A space's colour: a small square. */
export const SpaceDot = ({ color, className }: { color: string; className?: string }) => (
  <span
    className={cn('inline-block h-2 w-2 flex-none rounded-[2px]', className)}
    style={{ background: color }}
  />
);

/** A panel: its head on sand (an icon, a title, an action), its body on paper. */
export function Panel({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-rule bg-sand',
        className,
      )}
    >
      {title !== undefined && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2.5 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2 text-bark">
            {icon}
            <h2 className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
          </span>
          {action}
        </header>
      )}
      <div
        className={cn(
          'min-w-0 flex-1 bg-paper',
          title !== undefined && 'border-t border-rule',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** A row of a list (the v2 nw-row): padded 10px/16px, ruled, sand on hover. */
export const rowClass =
  'flex min-w-0 items-center gap-3 border-b border-rule px-4 py-2.5 last:border-0 hover:bg-sand';

/** The figures of a page (the v2 nw-stats): one ruled band, 12px corners, on paper. */
export function Stats({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-rule bg-paper md:grid-cols-4 [&>*]:border-rule [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b md:[&>*]:border-r md:[&>*]:border-b-0 md:[&>*:last-child]:border-r-0">
      {children}
    </div>
  );
}
export function Stat({
  label,
  icon,
  value,
  sub,
  bad,
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  bad?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1 px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 text-[13px] text-bark">
        {icon}
        {label}
      </span>
      <b className={cn('text-[26px] leading-[1.1] font-bold', bad && 'text-error')}>{value}</b>
      {sub && <span className={cn('text-[12.5px] text-bark', bad && 'text-error')}>{sub}</span>}
    </div>
  );
}

export function PageHead({
  title,
  lead,
  actions,
  icon,
  badge,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-[-0.01em]">
          {icon}
          <span className="truncate">{title}</span>
          {badge && <Built>{badge}</Built>}
        </h1>
        {lead && <p className="mt-0.5 text-[13px] text-bark">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      <b className="font-display text-[15px] font-semibold">{title}</b>
      {lead && <p className="max-w-md text-[13px] text-bark">{lead}</p>}
      {action}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => (
  <span className={cn('block animate-pulse rounded-[2px] bg-sand', className)} />
);

/** « il y a 5 min », « hier », « 3 nov. » */
export function ago(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr', { day: 'numeric', month: 'short' });
}

export function Menu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: ReactNode;
  items: { label: ReactNode; onSelect: () => void; danger?: boolean }[];
  align?: 'start' | 'end';
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[220px] rounded-[2px] border border-rule bg-paper p-1 shadow-card"
        >
          {items.map((item, at) => (
            <Dropdown.Item
              key={at}
              onSelect={item.onSelect}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-[2px] p-2 text-[13.5px] outline-none data-[highlighted]:bg-sand',
                item.danger && 'text-error',
              )}
            >
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/** A panel from the side (a card, a form), or the whole screen on a phone. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'right' | 'left';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 z-50 flex flex-col shadow-card',
            side === 'right'
              ? 'right-0 w-full border-l border-rule bg-paper sm:w-[440px]'
              : 'left-0 w-[280px] bg-canvas',
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {side === 'right' && (
            <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <b className="truncate font-display text-[15px] font-semibold">{title}</b>
              <Dialog.Close asChild>
                <IconButton aria-label="Fermer">
                  <X size={16} />
                </IconButton>
              </Dialog.Close>
            </header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Choices side by side (the v2 segmented): the chosen one lifted on paper. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; n?: number }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[2px] border border-rule bg-sand p-[3px]"
    >
      {options.map((one) => (
        <button
          key={one.value}
          aria-pressed={one.value === value}
          onClick={() => onChange(one.value)}
          className={cn(
            'cursor-pointer rounded-[2px] px-2.5 py-[5px] text-[13px] whitespace-nowrap',
            one.value === value
              ? 'bg-paper font-semibold text-ink shadow-card'
              : 'text-bark hover:text-ink',
          )}
        >
          {one.label}
          {one.n !== undefined && (
            <span className="ml-1 font-mono text-xs text-faint">{one.n}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** A page's tabs (an app's views, the settings): underlined, the current one in clay. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <nav className="-mt-1 flex gap-0.5 overflow-x-auto border-b border-rule" aria-label={label}>
      {tabs.map(({ key, label: words }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-current={value === key ? 'page' : undefined}
          className={cn(
            '-mb-px cursor-pointer border-b-2 px-3 py-2 text-[13.5px] whitespace-nowrap',
            value === key
              ? 'border-primary font-semibold text-ink'
              : 'border-transparent text-bark hover:text-ink',
          )}
        >
          {words}
        </button>
      ))}
    </nav>
  );
}

/** A text field, a select: the v2 input — ruled, 2px, clay when focused. */
export const inputClass =
  'h-9 w-full min-w-0 rounded-[2px] border border-rule bg-paper px-3 text-[13.5px] outline-none focus:border-primary disabled:opacity-60';
