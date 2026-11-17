import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { clsx, type ClassValue } from 'clsx';
import { X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// The primitives (v3 D17): one look for every screen, from the mockup's tokens. Never a coloured
// border on the left of anything: a dot or a tint says the colour.

export const cn = (...values: ClassValue[]) => clsx(values);

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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        tone === 'solid' && 'bg-ink text-paper hover:bg-primary-strong',
        tone === 'plain' && 'border border-rule-strong bg-paper text-ink hover:bg-sand',
        tone === 'quiet' && 'text-bark hover:bg-sand hover:text-ink',
        tone === 'danger' && 'bg-error text-paper hover:opacity-90',
        className,
      )}
    />
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'verify' | 'error';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium max-w-full truncate',
        tone === 'neutral' && 'bg-sand text-bark',
        tone === 'info' && 'bg-info-surface text-info',
        tone === 'success' && 'bg-success-surface text-success',
        tone === 'verify' && 'bg-verify-surface text-verify',
        tone === 'error' && 'bg-error-surface text-error',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A stable colour for a name: the same person, the same colour, every time. */
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

export function Avatar({
  name,
  src,
  size = 28,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid place-items-center rounded-full font-display font-semibold text-white flex-none overflow-hidden',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorOf(name) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

export const Dot = ({ color, className }: { color: string; className?: string }) => (
  <span
    className={cn('inline-block h-2 w-2 rounded-full flex-none', className)}
    style={{ background: color }}
  />
);

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-rule bg-paper shadow-card min-w-0 overflow-hidden',
        className,
      )}
    >
      {title !== undefined && (
        <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <h2 className="font-display text-[15px] font-semibold truncate">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({
  title,
  lead,
  actions,
  icon,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight md:text-[28px]">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {lead && <p className="mt-1 text-sm text-bark">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
      <b className="font-display text-base">{title}</b>
      {lead && <p className="max-w-md text-sm text-bark">{lead}</p>}
      {action}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => (
  <span className={cn('block animate-pulse rounded-md bg-sand', className)} />
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
          className="z-50 min-w-[200px] rounded-lg border border-rule-strong bg-paper p-1 shadow-card"
        >
          {items.map((item, at) => (
            <Dropdown.Item
              key={at}
              onSelect={item.onSelect}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-sand',
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 z-50 flex w-full flex-col bg-paper shadow-card sm:w-[440px]',
            side === 'right' ? 'right-0 border-l border-rule' : 'left-0 border-r border-rule',
          )}
        >
          <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <Dialog.Title className="font-display text-base font-semibold truncate">
              {title}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1.5 text-bark hover:bg-sand" aria-label="Fermer">
              <X size={18} />
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
