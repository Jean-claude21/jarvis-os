import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type Entry } from '../lib/api';
import { ACROSS, APPS, JOURNAL, TODAY } from './nav';
const LIVE = [TODAY, ...ACROSS, APPS, JOURNAL];
import { useKindName } from '../lib/kinds';

// Ctrl K (v3 D17): go anywhere, find anything she keeps. Later: commands, and asking an assistant.

export function Palette({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const navigate = useNavigate();
  const kindName = useKindName();
  const [text, setText] = useState('');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  const words = text.trim();
  const { data: found = [] } = useQuery({
    queryKey: ['entries', 'search', words],
    queryFn: () => api<Entry[]>(`/entries?limit=12&text=${encodeURIComponent(words)}`),
    enabled: open && words.length >= 2,
  });
  const places = LIVE.filter(
    (item) => !words || item.label.toLowerCase().includes(words.toLowerCase()),
  );
  const go = (to: string) => {
    setOpen(false);
    setText('');
    void navigate({ to });
  };
  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Chercher"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-ink/30"
      contentClassName="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border border-rule-strong bg-paper shadow-card"
    >
      <Command.Input
        value={text}
        onValueChange={setText}
        placeholder="Chercher une entrée, aller quelque part…"
        className="w-full border-b border-rule bg-transparent px-4 py-3.5 text-[15px] outline-none focus-visible:outline-none placeholder:text-faint"
      />
      <Command.List className="max-h-[56vh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-bark">
          Rien trouvé.
        </Command.Empty>
        {found.length > 0 && (
          <Command.Group
            heading="Entrées"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
          >
            {found.map((entry) => (
              <Command.Item
                key={entry.id}
                value={entry.id}
                onSelect={() => go(`/entree/${entry.id}`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm data-[selected=true]:bg-sand"
              >
                <FileText size={16} className="flex-none text-faint" />
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                <span className="flex-none text-xs text-faint">{kindName(entry.kind)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {places.length > 0 && (
          <Command.Group
            heading="Aller à"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
          >
            {places.map(({ to, label, icon: Icon }) => (
              <Command.Item
                key={to}
                value={`go-${to}`}
                onSelect={() => go(to)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm data-[selected=true]:bg-sand"
              >
                <Icon size={16} className="flex-none text-faint" />
                {label}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
