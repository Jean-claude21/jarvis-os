import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { BookOpen, Download } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useKindName } from '../lib/kinds';
import { Button, PageHead, Panel, Sheet, Skeleton, Tabs, rowClass } from '../ui';
import { Select, toast } from '../ui/more';
import { Markdown } from '../ui/Markdown';
import { ComponentsCatalog } from './Catalog';
import {
  AgentPage,
  AgentsList,
  TaskEditor,
  planOfSchedule,
  useAgents,
  useTasks,
  whenText,
  type Plan,
} from './Agents';

export { AgentPage };

// L'Atelier (v3 D12, D17 « Construire »): who works for her — her agents, each a named setting of
// the one node (its triggers, its executor, its skills, what it reads and writes, how free it is,
// its budget, its Pause) — and the skills they follow, in the Agent Skills format.

export type AtelierTab = 'automations' | 'skills' | 'components';
export const atelierSearch = (search: Record<string, unknown>): { t?: AtelierTab } =>
  search.t === 'skills' || search.t === 'components' ? { t: search.t } : {};

export function AtelierPage() {
  const search = useSearch({ strict: false }) as { t?: AtelierTab };
  const navigate = useNavigate();
  const tab = search.t ?? 'automations';
  return (
    <>
      <PageHead
        title="Construire"
        lead="Ce qui travaille pour toi, comment, et dans quelles limites."
      />
      <Tabs
        tabs={[
          { key: 'automations', label: 'Agents et automatismes' },
          { key: 'skills', label: 'Skills' },
          { key: 'components', label: 'Composants' },
        ]}
        value={tab}
        label="Construire"
        onChange={(key) =>
          void navigate({ to: '/construire', search: key === 'automations' ? {} : { t: key } })
        }
      />
      {tab === 'automations' ? (
        <AgentsList />
      ) : tab === 'skills' ? (
        <SkillsList />
      ) : (
        <ComponentsCatalog />
      )}
    </>
  );
}

interface MineSkill {
  id: string;
  title: string;
  spaceId: string;
  /** In its five parts (spec 047); else a text, which can be proposed in them. */
  structured: boolean;
  /** What started it before spec 109: a phrase stays its shortcut, a moment moves to a task. */
  triggers: Record<string, unknown>[];
  excerpt: string;
}
interface Skill {
  name: string;
  when: string;
  /** Its instructions, in Markdown: read here, without downloading. */
  text?: string;
}
const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function SkillsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api<{ jarvis?: Skill[]; mine?: MineSkill[] }>('/skills'),
  });
  const [open, setOpen] = useState<Skill | null>(null);
  const kindName = useKindName();
  const client = useQueryClient();
  const { data: tasks = [] } = useTasks();
  const { data: agents = [] } = useAgents();
  // « En faire une tâche » (spec 109): a skill's moment moves to a task of an agent; the skill keeps
  // its method — once the task is kept, its moment leaves the skill.
  const [making, setMaking] = useState<{
    skill: MineSkill;
    agent: string;
    plan: Plan | null;
  } | null>(null);
  const moved = useMutation({
    mutationFn: (one: MineSkill) =>
      api('/save', {
        method: 'POST',
        space: one.spaceId,
        body: {
          entries: [
            {
              id: one.id,
              data: { triggers: one.triggers.filter((t) => typeof t.schedule !== 'string') },
            },
          ],
        },
      }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['skills'] }),
  });
  // A skill kept as text, proposed in its five parts (trigger, preparation, instructions,
  // references, result): it waits for her yes in « À valider ».
  const structure = useMutation({
    mutationFn: (one: MineSkill) =>
      api(`/routines/${encodeURIComponent(one.id)}/structure`, {
        method: 'POST',
        space: one.spaceId,
      }),
    onSuccess: () => toast('Proposé en cinq morceaux : il t’attend dans « À valider ».'),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => void client.invalidateQueries({ queryKey: ['now'] }),
  });
  if (isLoading) return <Skeleton className="h-40" />;
  const skills = data?.jarvis ?? [];
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Panel
        title="Les skills de Jarvis"
        icon={<BookOpen size={16} />}
        action={
          <span className="text-xs text-faint">
            au format Agent Skills : ils marchent aussi dans Claude
          </span>
        }
      >
        {skills.map((one) => (
          <div key={one.name} className={rowClass + ' flex-wrap'}>
            <button
              onClick={() => setOpen(one)}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <b className="block truncate font-semibold hover:underline">{one.name}</b>
              <span className="line-clamp-2 text-[12.5px] text-bark">Quand {one.when}</span>
            </button>
            <Button size="sm" onClick={() => setOpen(one)}>
              <BookOpen size={14} />
              Lire
            </Button>
            <a
              href={`/api/skills/${slug(one.name)}/SKILL.md?download=1`}
              className="inline-flex h-8 flex-none items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
            >
              <Download size={14} />
              SKILL.md
            </a>
          </div>
        ))}
      </Panel>
      <Panel title="Tes skills" icon={<BookOpen size={16} />}>
        {!(data?.mine ?? []).length ? (
          <p className="px-4 py-4 text-[13px] text-bark">
            Aucun skill à toi : dis à Claude « fais-en un skill » après une façon de faire qui te
            plaît.
          </p>
        ) : (
          (data?.mine ?? []).map((one) => {
            const moments = one.triggers.filter((t) => typeof t.schedule === 'string');
            const phrases = one.triggers.filter((t) => typeof t.phrase === 'string');
            const users = tasks.filter((task) => task.skill === one.title);
            return (
              <div key={one.id} className={rowClass + ' flex-wrap'}>
                <span className="min-w-0 flex-1">
                  <Link
                    to="/entree/$id"
                    params={{ id: one.id }}
                    className="block truncate font-semibold hover:underline"
                  >
                    {one.title}
                  </Link>
                  <span className="line-clamp-2 text-[12.5px] text-bark">{one.excerpt}</span>
                  <span className="block text-[12.5px]">
                    {users.length ? (
                      <>
                        Suivi par{' '}
                        {users.map((task, at) => (
                          <span key={task.id}>
                            {at > 0 && ', '}
                            <Link
                              to="/construire/agents/$name"
                              params={{ name: task.agent ?? '' }}
                              className="font-medium text-ink underline underline-offset-2"
                            >
                              {task.agent} › {task.title}
                            </Link>
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="text-bark">Suivi quand tu le demandes à ton assistant.</span>
                    )}
                    {phrases.length > 0 && (
                      <span className="text-bark">
                        {' '}
                        · raccourci {phrases.map((t) => `« ${String(t.phrase)} »`).join(', ')}
                      </span>
                    )}
                  </span>
                  {moments.length > 0 && (
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-ochre">
                      Son moment (
                      {moments
                        .map((t) => whenText(t, planOfSchedule(String(t.schedule)), kindName))
                        .join(', ')}
                      ) appartient à une tâche :
                      <Select
                        label={`Faire de « ${one.title} » une tâche de l’agent…`}
                        value=""
                        placeholder="En faire une tâche de…"
                        onChange={(agent) =>
                          setMaking({
                            skill: one,
                            agent,
                            plan: planOfSchedule(String(moments[0]!.schedule)),
                          })
                        }
                        options={agents
                          .filter((a) => !a.data.builtin?.length)
                          .map((a) => ({ value: a.title, label: a.title }))}
                        className="w-52"
                      />
                    </span>
                  )}
                </span>
                {!one.structured && (
                  <Button
                    size="sm"
                    disabled={structure.isPending}
                    onClick={() => structure.mutate(one)}
                  >
                    Structurer
                  </Button>
                )}
              </div>
            );
          })
        )}
      </Panel>
      <Sheet
        open={!!open}
        onOpenChange={(value) => !value && setOpen(null)}
        title={open?.name ?? ''}
      >
        {open && (
          <div className="grid gap-3 p-4">
            <p className="text-[13px] text-bark">
              <b className="text-ink">Quand :</b> {open.when}
            </p>
            <Markdown text={open.text ?? ''} />
            <a
              href={`/api/skills/${slug(open.name)}/SKILL.md?download=1`}
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
            >
              <Download size={14} />
              Télécharger SKILL.md
            </a>
          </div>
        )}
      </Sheet>
      {making && (
        <TaskEditor
          agent={making.agent}
          draft={{ skill: making.skill.title, ...(making.plan ? { plan: making.plan } : {}) }}
          open
          onOpenChange={(value) => !value && setMaking(null)}
          onSaved={() => moved.mutate(making.skill)}
        />
      )}
    </div>
  );
}
