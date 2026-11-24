import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { FileText, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type Entry } from '../lib/api';
import { ACROSS, APPS, DASHBOARDS, JOURNAL, TODAY } from './nav';
const LIVE = [TODAY, ...ACROSS, DASHBOARDS, APPS, JOURNAL];
import { useKindName } from '../lib/kinds';
import { toast } from '../ui/more';

// Ctrl K (v3 D17): note something at once, go anywhere, find anything she keeps. A note is kept as
// she said it, in « À valider » to file (the same door as Telegram); a phrase (« /bilan ») starts
// what it names (F6).

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
  const client = useQueryClient();
  const note = useMutation({
    mutationFn: (said: string) =>
      api<{ title: string; data: { status?: string } }>('/inbox', {
        method: 'POST',
        body: { text: said },
      }),
    onSuccess: (kept, said) => {
      setOpen(false);
      setText('');
      toast(
        kept.data.status === 'filed'
          ? `« ${said.split(/\s/)[0]} » : c’est lancé.`
          : 'Gardé ✓ — il t’attend dans « À valider » pour être rangé.',
      );
      void client.invalidateQueries({ queryKey: ['now'] });
      void client.invalidateQueries({ queryKey: ['history'] });
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  // A question with a figure (spec 049): « combien en transport en octobre ? » is answered here,
  // computed from her entries, with how many it counted.
  const asks =
    words.length > 6 && /\?$|^(combien|quel total|total|moyenne|how much)\b/i.test(words);
  const { data: answer } = useQuery({
    queryKey: ['answer', words],
    queryFn: () =>
      api<{
        figure: number;
        currency: string | null;
        count: number;
        question: { period: string; mode: 'sum' | 'count' };
      }>(`/answer?q=${encodeURIComponent(words)}`),
    enabled: open && asks,
    retry: false,
  });
  const go = (to: string) => {
    setOpen(false);
    setText('');
    void navigate({ to });
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border border-rule-strong bg-paper shadow-card"
        >
          <Dialog.Title className="sr-only">Chercher ou noter</Dialog.Title>
          <Command label="Chercher ou noter" shouldFilter={false}>
            <Command.Input
              value={text}
              onValueChange={setText}
              placeholder="Noter quelque chose, chercher, aller quelque part…"
              className="w-full border-b border-rule bg-transparent px-4 py-3.5 text-[15px] outline-none focus-visible:outline-none placeholder:text-faint"
            />
            <Command.List className="max-h-[56vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-bark">
                Rien trouvé.
              </Command.Empty>
              {answer && answer.count > 0 && (
                <Command.Group
                  heading="Réponse"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
                >
                  <Command.Item
                    value="answer"
                    onSelect={() => setOpen(false)}
                    className="flex cursor-pointer items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-sm data-[selected=true]:bg-sand"
                  >
                    <b className="font-display text-[18px]">
                      {answer.figure.toLocaleString('fr')}
                      {answer.question.mode === 'sum' && answer.currency
                        ? ` ${answer.currency}`
                        : ''}
                    </b>
                    <span className="min-w-0 flex-1 truncate text-bark">
                      {answer.count} entrée(s) · {answer.question.period}
                    </span>
                  </Command.Item>
                </Command.Group>
              )}
              {words.length > 0 && (
                <Command.Group
                  heading="Noter"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
                >
                  <Command.Item
                    value="note"
                    disabled={note.isPending}
                    onSelect={() => note.mutate(words)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm data-[selected=true]:bg-sand"
                  >
                    <PenLine size={16} className="flex-none text-primary" />
                    <span className="min-w-0 flex-1 truncate">
                      {words.startsWith('/') ? 'Lancer' : 'Noter'} « {words} »
                    </span>
                    <kbd className="flex-none font-mono text-[11px] text-faint">Entrée</kbd>
                  </Command.Item>
                </Command.Group>
              )}
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
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
