import * as Dialog from '@radix-ui/react-dialog';
import {
  Archive,
  ChevronDown,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Music,
  Upload,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button, cn, inputClass } from './index';

// More primitives of the registry (v3 D21): a select, a date, a confirmation, a brief message, a
// drop zone, a file's icon — each once, each in J-C's design system, used everywhere.

/** A choice among many (more than four; fewer: Segmented). */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  placeholder,
}: {
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <span className={cn('relative inline-flex min-w-0', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(inputClass, 'cursor-pointer appearance-none pr-8')}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((one) => (
          <option key={one.value} value={one.value}>
            {one.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-bark"
      />
    </span>
  );
}

/** A day (or a day and an hour). */
export function DateInput({
  value,
  onChange,
  label,
  time = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  time?: boolean;
  className?: string;
}) {
  return (
    <input
      type={time ? 'datetime-local' : 'date'}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(inputClass.replace('w-full', 'w-auto'), className)}
    />
  );
}

/** Before a gesture one does not undo in a click: what it does, in her words, and two buttons. */
export function Confirm({
  open,
  onOpenChange,
  title,
  lead,
  yes,
  onYes,
  danger = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  lead?: ReactNode;
  yes: string;
  onYes: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-rule bg-paper p-5 shadow-card">
          <Dialog.Title className="font-display text-[17px] font-semibold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-1.5 text-[13.5px] text-bark">{lead}</div>
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
            <Button
              tone={danger ? 'danger' : 'solid'}
              onClick={() => {
                onYes();
                onOpenChange(false);
              }}
            >
              {yes}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Asks first, then does: `ask(…)` opens the confirmation, `node` draws it. */
export function useConfirm() {
  const [asked, setAsked] = useState<{
    title: string;
    lead?: ReactNode;
    yes: string;
    danger?: boolean;
    then: () => void;
  } | null>(null);
  return {
    ask: (one: NonNullable<typeof asked>) => setAsked(one),
    node: asked ? (
      <Confirm
        open
        onOpenChange={(open) => !open && setAsked(null)}
        title={asked.title}
        lead={asked.lead}
        yes={asked.yes}
        danger={asked.danger ?? false}
        onYes={asked.then}
      />
    ) : null,
  };
}

// A brief message (toast): what just happened, in one sentence, gone after a while.
type Toast = { id: number; text: string; tone: 'info' | 'error' };
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
const changed = () => {
  for (const one of toastListeners) one();
};
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, tone }].slice(-3);
  changed();
  setTimeout(() => {
    toasts = toasts.filter((one) => one.id !== id);
    changed();
  }, 5000);
}
export function Toaster() {
  const list = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener);
      return () => toastListeners.delete(listener);
    },
    () => toasts,
  );
  if (!list.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 grid w-[min(92vw,360px)] gap-2" role="status">
      {list.map((one) => (
        <div
          key={one.id}
          className={cn(
            'rounded-[12px] border bg-paper px-4 py-3 text-[13px] shadow-card',
            one.tone === 'error' ? 'border-error text-error' : 'border-rule',
          )}
        >
          {one.text}
        </div>
      ))}
    </div>
  );
}

/** A place to drop files (and a button for those who click). */
export function DropZone({
  onFiles,
  busy = false,
  lead = 'Glisse des fichiers ici, ou choisis-les.',
  className,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  lead?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setHover(false);
        onFiles([...event.dataTransfer.files]);
      }}
      className={cn(
        'flex flex-wrap items-center justify-center gap-3 rounded-[10px] border border-dashed border-rule-strong px-4 py-4 text-center text-[13px] text-bark',
        hover && 'border-primary bg-sand',
        className,
      )}
    >
      <span>{busy ? 'Dépôt en cours…' : lead}</span>
      <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Upload size={14} />
        Choisir
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(event) => onFiles([...(event.target.files ?? [])])}
      />
    </div>
  );
}

/** What a file is, by its type or its name: its icon and its colour. */
export const FILE_GENRES: {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  test: (mediaType: string, name: string) => boolean;
}[] = [
  { key: 'pdf', label: 'PDF', icon: FileText, color: '#b83a1b', test: (t) => /pdf/.test(t) },
  {
    key: 'image',
    label: 'Image',
    icon: FileImage,
    color: '#2f6f5e',
    test: (t) => /^image\//.test(t),
  },
  {
    key: 'sheet',
    label: 'Tableur',
    icon: FileSpreadsheet,
    color: '#3b7a3a',
    test: (t, n) => /sheet|excel|csv/.test(t) || /\.(xlsx?|csv|ods)$/i.test(n),
  },
  {
    key: 'doc',
    label: 'Document',
    icon: FileType,
    color: '#4a5fa8',
    test: (t, n) => /word|document|text\/|markdown/.test(t) || /\.(docx?|odt|txt|md)$/i.test(n),
  },
  { key: 'audio', label: 'Son', icon: Music, color: '#a8862a', test: (t) => /^audio\//.test(t) },
  { key: 'video', label: 'Vidéo', icon: Video, color: '#9e4a5a', test: (t) => /^video\//.test(t) },
  {
    key: 'archive',
    label: 'Archive',
    icon: Archive,
    color: '#8a5a9e',
    test: (t) => /zip|compressed|tar/.test(t),
  },
];
const OTHER = { key: 'other', label: 'Autre', icon: File, color: '#9a8276', test: () => true };
export const fileGenreOf = (mediaType: string, name: string) =>
  FILE_GENRES.find((one) => one.test(mediaType, name)) ?? OTHER;

export function FileIcon({
  mediaType,
  name,
  size = 32,
}: {
  mediaType: string;
  name: string;
  size?: number;
}) {
  const one = fileGenreOf(mediaType, name);
  return (
    <span
      className="grid flex-none place-items-center rounded-[8px]"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${one.color} 14%, var(--paper))`,
        color: one.color,
      }}
      title={one.label}
    >
      <one.icon size={Math.round(size * 0.5)} />
    </span>
  );
}
