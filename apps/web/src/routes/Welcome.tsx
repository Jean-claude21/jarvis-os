import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Bot, Check, Copy, LayoutGrid, PenLine, Sparkles, Sunrise } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useKinds } from '../lib/kinds';
import { Button, Panel, cn, rowClass } from '../ui';
import { toast } from '../ui/more';

// « Pour commencer » (v3, the v2's « Bienvenue »): a new account's first steps, on Aujourd'hui
// until she closes them. Each step ticks itself when it is done — nothing to declare: an assistant
// connected, an app added, a brief hour chosen, a first thing noted. Jarvis is first spoken to: the
// screen is there to check.

/** How a space is built: no step counts these as « a first thing noted ». */
const STRUCTURE = new Set([
  'model',
  'page',
  'view',
  'app',
  'area',
  'agent',
  'rule',
  'script',
  'channel',
]);

export function Welcome({ onNote }: { onNote: () => void }) {
  const client = useQueryClient();
  const prefs = useQuery({
    queryKey: ['me', 'prefs'],
    queryFn: () => api<{ brief?: string | null; welcomed?: boolean }>('/me/prefs'),
  });
  const assistants = useQuery({
    queryKey: ['assistants'],
    queryFn: () => api<unknown[]>('/connections'),
    enabled: prefs.data?.welcomed !== true,
  });
  const apps = useQuery({
    queryKey: ['apps', 'mine-count'],
    queryFn: () => api<{ apps: unknown[] }>('/apps/mine'),
    enabled: prefs.data?.welcomed !== true,
  });
  const { data: kinds = [] } = useKinds();
  const close = useMutation({
    mutationFn: () => api('/me/prefs', { method: 'POST', body: { welcomed: true } }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['me', 'prefs'] }),
  });
  if (!prefs.data || prefs.data.welcomed) return null;
  const address = `${location.origin}/mcp`;
  const steps: {
    done: boolean;
    title: string;
    lead: string;
    icon: LucideIcon;
    action: React.ReactNode;
  }[] = [
    {
      done: (assistants.data ?? []).length > 0,
      title: 'Relie ton assistant',
      lead: 'Dans Claude (ou ChatGPT) : Réglages › Connecteurs › Ajouter, avec cette adresse. Tu lui parles, Jarvis range.',
      icon: Bot,
      action: (
        <Button
          size="sm"
          onClick={() =>
            void navigator.clipboard
              .writeText(address)
              .then(() => toast('Adresse copiée.'))
              .catch(() => toast(address))
          }
        >
          <Copy size={14} />
          {address}
        </Button>
      ),
    },
    {
      done: (apps.data?.apps ?? []).length > 0,
      title: 'Ajoute une app',
      lead: 'Finances, Candidatures, Garanties… chacune range un pan de ta vie, avec ses pages et ses automatismes.',
      icon: LayoutGrid,
      action: (
        <Link to="/apps" className="text-[13px] font-semibold text-primary hover:underline">
          Voir les apps
        </Link>
      ),
    },
    {
      done: !!prefs.data.brief,
      title: 'Choisis l’heure de ton brief',
      lead: 'Chaque matin, ta journée en quelques lignes : sur Telegram, sinon par e-mail.',
      icon: Sunrise,
      action: (
        <Link to="/reglages" className="text-[13px] font-semibold text-primary hover:underline">
          Ouvrir Réglages
        </Link>
      ),
    },
    {
      done: kinds.some((one) => one.count > 0 && !STRUCTURE.has(one.kind.toLowerCase())),
      title: 'Note une première chose',
      lead: 'Une idée, une dépense, un rendez-vous : comme tu le dirais. Elle t’attend dans « À valider ».',
      icon: PenLine,
      action: (
        <Button size="sm" onClick={onNote}>
          <PenLine size={14} />
          Noter
        </Button>
      ),
    },
  ];
  const left = steps.filter((one) => !one.done).length;
  return (
    <Panel
      title="Pour commencer"
      icon={<Sparkles size={16} />}
      action={
        <Button size="sm" tone="quiet" disabled={close.isPending} onClick={() => close.mutate()}>
          {left ? 'Plus tard' : 'C’est bon'}
        </Button>
      }
    >
      {steps.map((step) => (
        <div key={step.title} className={rowClass + ' flex-wrap'}>
          <span
            className={cn(
              'grid h-7 w-7 flex-none place-items-center rounded-full border',
              step.done ? 'border-success bg-success text-paper' : 'border-rule text-faint',
            )}
            aria-label={step.done ? 'fait' : 'à faire'}
          >
            {step.done ? <Check size={14} /> : <step.icon size={14} />}
          </span>
          <span className="min-w-0 flex-1">
            <b className={cn('block font-semibold', step.done && 'text-bark line-through')}>
              {step.title}
            </b>
            <span className="block text-[12.5px] text-bark">{step.lead}</span>
          </span>
          {!step.done && <span className="max-w-full min-w-0 truncate">{step.action}</span>}
        </div>
      ))}
    </Panel>
  );
}
