import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  Bot,
  CalendarSync,
  Archive,
  Download,
  KeyRound,
  Link2,
  MailPlus,
  Plug,
  RefreshCw,
  Send,
  Sunrise,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { api, type Space } from '../lib/api';
import { useSession } from '../lib/session';
import {
  Avatar,
  Button,
  Empty,
  PageHead,
  Panel,
  Sheet,
  Skeleton,
  SpaceDot,
  Tabs,
  Tag,
  ago,
  inputClass,
  rowClass,
  type TagTone,
} from '../ui';
import { Logo } from '../ui/identity';
import { toast } from '../ui/more';
import { useKindName } from '../lib/kinds';

// Réglages (v3 D15, D16): what is hers to set, in four places — her account, her spaces and who
// is in them, the services Jarvis reaches for her (connections), and the assistants that reach
// Jarvis (their access, her keys). Each a tab, kept in the URL.

export type SettingsTab = 'compte' | 'espaces' | 'connexions' | 'assistants';
export interface SettingsSearch {
  t?: SettingsTab | undefined;
  s?: string | undefined;
}
const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'compte', label: 'Compte' },
  { key: 'espaces', label: 'Espaces et membres' },
  { key: 'connexions', label: 'Connexions' },
  { key: 'assistants', label: 'Assistants' },
];
export const settingsSearch = (search: Record<string, unknown>): SettingsSearch => ({
  ...(TABS.some((one) => one.key === search.t) ? { t: search.t as SettingsTab } : {}),
  ...(typeof search.s === 'string' && search.s.length < 80 ? { s: search.s } : {}),
});

export function SettingsPage() {
  const search = useSearch({ strict: false }) as SettingsSearch;
  const navigate = useNavigate();
  const tab = search.t ?? 'compte';
  return (
    <>
      <PageHead
        title="Réglages"
        lead="Ton compte, tes espaces et leurs membres, ce que Jarvis relie pour toi."
      />
      <Tabs
        tabs={TABS}
        value={tab}
        label="Réglages"
        onChange={(key) => void navigate({ to: '/reglages', search: { t: key } })}
      />
      {tab === 'compte' ? (
        <Account />
      ) : tab === 'espaces' ? (
        <Spaces chosen={search.s} />
      ) : tab === 'connexions' ? (
        <Connections />
      ) : (
        <Assistants />
      )}
    </>
  );
}

const ZONES = [
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/London',
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Douala',
  'Africa/Lome',
  'Africa/Casablanca',
  'America/Montreal',
  'America/New_York',
  'UTC',
];

/**
 * A folder of notes in Markdown (Obsidian, Notion exported…) brought into the space she is in
 * (spec 007): each note an entry, its links followed; one line in the journal, undone at once.
 * Importing it again finds the same entries: nothing is made twice.
 */
function ImportNotes() {
  const client = useQueryClient();
  const importing = useMutation({
    mutationFn: async (files: File[]) => {
      const notes = files.filter((file) => /\.md$/i.test(file.name));
      if (!notes.length) throw new Error('Aucune note Markdown (.md) dans ce dossier.');
      const folder = (notes[0]!.webkitRelativePath || notes[0]!.name).split('/')[0] ?? '';
      const docs = await Promise.all(
        notes.map(async (file) => ({
          path: (file.webkitRelativePath || file.name).split('/').slice(1).join('/') || file.name,
          text: await file.text(),
        })),
      );
      return api<{ created: number; updated: number; unchanged: number }>('/import', {
        method: 'POST',
        body: { docs, name: folder },
      });
    },
    onSuccess: (done) =>
      toast(
        `${done.created} note(s) ajoutée(s), ${done.updated} mise(s) à jour, ${done.unchanged} inchangée(s) — annulable dans l’Activité.`,
      ),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['entries'] });
      void client.invalidateQueries({ queryKey: ['kinds'] });
      void client.invalidateQueries({ queryKey: ['history'] });
    },
  });
  return (
    <div className="flex flex-col gap-2 border-t border-rule px-4 py-3 text-[13px]">
      <p className="text-bark">
        Un dossier de notes en Markdown (Obsidian, un export de Notion…) : chaque note devient une
        entrée, ses liens suivis. Le réimporter ne crée rien deux fois.
      </p>
      <label className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 font-semibold hover:border-rule-strong">
        <Upload size={14} />
        {importing.isPending ? 'Import…' : 'Importer un dossier de notes'}
        <input
          type="file"
          multiple
          className="sr-only"
          aria-label="Dossier de notes"
          {...({ webkitdirectory: '' } as Record<string, string>)}
          disabled={importing.isPending}
          onChange={(event) => {
            // Copied first: emptying the input empties its live list of files.
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            if (files.length) importing.mutate(files);
          }}
        />
      </label>
    </div>
  );
}

interface Sent {
  id: number;
  channel: string;
  kind: string;
  subject: string;
  state: 'queued' | 'sent' | 'failed' | 'acted';
  createdAt: string;
  lastError: string | null;
}
const SENT_STATE: Record<Sent['state'], { label: string; tone: 'ok' | 'late' | 'error' | 'info' }> =
  {
    queued: { label: 'en attente', tone: 'late' },
    sent: { label: 'envoyé', tone: 'ok' },
    acted: { label: 'suivi', tone: 'info' },
    failed: { label: 'échec', tone: 'error' },
  };

/** What Jarvis sent her these seven days (spec 020): each message, its channel, how it went. */
function SentPanel() {
  const sent = useQuery({ queryKey: ['outbox'], queryFn: () => api<Sent[]>('/outbox?days=7') });
  return (
    <Panel title="Ce que Jarvis t’a envoyé · 7 jours" icon={<Send size={16} />}>
      {!(sent.data ?? []).length ? (
        <p className="px-4 py-3 text-[13px] text-bark">Rien envoyé ces 7 jours.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {(sent.data ?? []).map((one) => (
            <div key={one.id} className={rowClass}>
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{one.subject || one.kind}</b>
                <span className="block truncate text-[12.5px] text-bark">
                  {one.channel === 'email' ? 'e-mail' : one.channel} · {ago(one.createdAt)}
                  {one.lastError ? ` · ${one.lastError}` : ''}
                </span>
              </span>
              <Tag tone={SENT_STATE[one.state].tone}>{SENT_STATE[one.state].label}</Tag>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

interface Backup {
  day: string;
  size: number;
  files: number;
}

/** The nightly backups of the space she is in (spec 022): each day, its size, a link to fetch it. */
function BackupsPanel() {
  const { space } = useSession();
  const backups = useQuery({
    queryKey: ['backups', space.id],
    queryFn: () => api<Backup[]>('/backups'),
  });
  const fetchOne = useMutation({
    mutationFn: (day: string) => api<{ url: string }>(`/backups/${day}/link`),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const size = (bytes: number) =>
    bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} Mo` : `${Math.ceil(bytes / 1000)} ko`;
  return (
    <Panel title={`Sauvegardes de « ${space.name} »`} icon={<Archive size={16} />}>
      {!(backups.data ?? []).length ? (
        <p className="px-4 py-3 text-[13px] text-bark">
          Pas encore de sauvegarde : elle se fait chaque nuit, et se garde quelques semaines.
        </p>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          {(backups.data ?? []).map((one) => (
            <div key={one.day} className={rowClass}>
              <span className="min-w-0 flex-1">
                <b className="block font-semibold">
                  {new Date(`${one.day}T12:00:00`).toLocaleDateString('fr', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </b>
                <span className="block text-[12.5px] text-bark">
                  {size(one.size)} · {one.files} fichier(s)
                </span>
              </span>
              <Button
                size="sm"
                disabled={fetchOne.isPending}
                onClick={() => fetchOne.mutate(one.day)}
              >
                <Download size={14} />
                Télécharger
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Her morning brief (spec 018, v3): the hour it comes, or none; read it now; have it sent now.
 * The Assistant du matin sends it each day at that hour, by Telegram when linked, else by e-mail.
 */
function BriefPanel() {
  const client = useQueryClient();
  const prefs = useQuery({
    queryKey: ['me', 'prefs'],
    queryFn: () => api<{ brief?: string | null }>('/me/prefs'),
  });
  const setHour = useMutation({
    mutationFn: (brief: string | null) => api('/me/prefs', { method: 'POST', body: { brief } }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['me', 'prefs'] });
      void client.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  const [reading, setReading] = useState(false);
  const now = useQuery({
    queryKey: ['me', 'brief'],
    queryFn: () => api<{ text: string }>('/me/brief'),
    enabled: reading,
  });
  const send = useMutation({
    mutationFn: () =>
      api<{ sent: boolean; via: 'telegram' | 'email' | null }>('/me/brief', { method: 'POST' }),
    onSuccess: (done) =>
      toast(
        done.sent
          ? `Envoyé ${done.via === 'telegram' ? 'sur Telegram' : 'par e-mail'}.`
          : 'Pas envoyé : relie ton Telegram, ou demande à ton administrateur de configurer l’e-mail.',
        done.sent ? undefined : 'error',
      ),
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const hour = prefs.data?.brief ?? null;
  return (
    <Panel title="Ton brief du matin" icon={<Sunrise size={16} />}>
      <div className="flex flex-col gap-3 px-4 py-3 text-[13px]">
        <p className="text-bark">
          Chaque matin, à l’heure choisie, Jarvis te dit ta journée : ce qui ne va pas, ce qui est
          en retard, ton agenda, tes habitudes. Sur Telegram si tu l’as relié, sinon par e-mail.
        </p>
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Chaque jour à</span>
          <input
            type="time"
            aria-label="Heure du brief"
            className={inputClass.replace('w-full', 'w-auto')}
            value={hour ?? ''}
            disabled={!prefs.data || setHour.isPending}
            onChange={(event) => event.target.value && setHour.mutate(event.target.value)}
          />
          {hour ? (
            <Button size="sm" tone="quiet" onClick={() => setHour.mutate(null)}>
              Plus de brief
            </Button>
          ) : (
            <span className="text-faint">pas de brief pour l’instant</span>
          )}
        </label>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setReading(true)}>
            Le lire maintenant
          </Button>
          <Button size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
            Me l’envoyer maintenant
          </Button>
        </span>
      </div>
      <Sheet open={reading} onOpenChange={setReading} title="Ta journée">
        <div className="p-4">
          {now.isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <pre className="font-sans text-[14px] leading-relaxed whitespace-pre-wrap">
              {now.data?.text ?? ''}
            </pre>
          )}
        </div>
      </Sheet>
    </Panel>
  );
}

function Account() {
  const { me } = useSession();
  const client = useQueryClient();
  const zone = useQuery({
    queryKey: ['me', 'zone'],
    queryFn: () => api<{ zone: string }>('/me/zone'),
  });
  const setZone = useMutation({
    mutationFn: (value: string) => api('/me/zone', { method: 'POST', body: { zone: value } }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['me', 'zone'] }),
  });
  const telegram = useMutation({
    mutationFn: () => api<{ link: string; minutes: number }>('/me/telegram', { method: 'POST' }),
  });
  const current = zone.data?.zone ?? '';
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Toi" icon={<UserRound size={16} />}>
        <div className="flex items-center gap-3 px-4 py-4">
          <Avatar name={me.person.name || me.person.email} size={44} />
          <span className="min-w-0">
            <b className="block truncate font-display text-[16px] font-semibold">
              {me.person.name}
            </b>
            <span className="block truncate text-[13px] text-bark">{me.person.email}</span>
          </span>
        </div>
        <label className="flex flex-col gap-1.5 border-t border-rule px-4 py-3">
          <span className="text-[13px] font-semibold">Fuseau horaire</span>
          <select
            className={inputClass}
            value={current}
            disabled={!zone.data || setZone.isPending}
            onChange={(event) => setZone.mutate(event.target.value)}
          >
            {[...new Set([current, ...ZONES])].filter(Boolean).map((one) => (
              <option key={one} value={one}>
                {one.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <span className="text-xs text-faint">
            Tes rappels, ton agenda et tes journées suivent cette heure.
          </span>
        </label>
      </Panel>
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="Telegram" icon={<Send size={16} />}>
          <div className="flex flex-col gap-2 px-4 py-3 text-[13px]">
            <p className="text-bark">
              Écris ou envoie une photo à Jarvis depuis Telegram : tout arrive dans « À valider ».
            </p>
            {telegram.data ? (
              <a
                href={telegram.data.link}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Ouvrir Telegram et relier ({telegram.data.minutes} min)
              </a>
            ) : (
              <span>
                <Button size="sm" disabled={telegram.isPending} onClick={() => telegram.mutate()}>
                  Relier mon Telegram
                </Button>
              </span>
            )}
            {telegram.error && <p className="text-error">{(telegram.error as Error).message}</p>}
          </div>
        </Panel>
        <BriefPanel />
        <SentPanel />
        <BackupsPanel />
        <Panel title="Tes données" icon={<Download size={16} />}>
          <div className="flex flex-col gap-2 px-4 py-3 text-[13px]">
            <p className="text-bark">
              Tout ce que tu as dans l’espace actif, en dossier Markdown avec tes fichiers : à toi,
              lisible sans Jarvis.
            </p>
            <a
              href="/api/export"
              className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 font-semibold hover:border-rule-strong"
            >
              <Download size={14} />
              Tout exporter
            </a>
          </div>
          <ImportNotes />
        </Panel>
      </div>
    </div>
  );
}

interface Member {
  person: string;
  role: 'owner' | 'member' | 'viewer';
  since: string;
  name: string | null;
  /** The kinds opened to her (v3 F7); null, everything. */
  kinds?: string[] | null;
}
interface SpaceAgent {
  title: string;
  data: { role?: string; paused?: boolean; autonomy?: string };
  state: string;
}
/**
 * How a space is built (migration 0036): every member reads it so her screens draw, none of it is
 * hers to open or close — the choice is among the kinds that hold a life.
 */
const STRUCTURE = new Set(['model', 'page', 'view', 'app', 'area', 'agent', 'rule', 'script']);
const AGENT_STATE: Record<string, string> = {
  idle: 'prêt',
  working: 'au travail',
  paused: 'en pause',
  over_budget: 'budget atteint',
  failing: 'en échec',
};
type SpaceFull = Space & { members: Member[] };
interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  state: 'open' | 'used' | 'expired' | 'withdrawn';
}
const ROLES: { value: Member['role']; label: string; lead: string }[] = [
  { value: 'owner', label: 'propriétaire', lead: 'règle l’espace et ses membres' },
  { value: 'member', label: 'membre', lead: 'lit et écrit' },
  { value: 'viewer', label: 'lecteur', lead: 'lit seulement' },
];
const SWATCHES = [
  '#b83a1b',
  '#2f6f5e',
  '#4a5fa8',
  '#8a5a9e',
  '#a8862a',
  '#3b8ea5',
  '#9e4a5a',
  '#6b4e43',
];

function Spaces({ chosen }: { chosen?: string | undefined }) {
  const { me, colorOf: spaceColor } = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const spaces = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => api<SpaceFull[]>('/spaces'),
  });
  const [name, setName] = useState('');
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['spaces'] });
    void client.invalidateQueries({ queryKey: ['me'] });
  };
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/spaces', { method: 'POST', body: { name } }),
    onSuccess: (made) => {
      setName('');
      void navigate({ to: '/reglages', search: { t: 'espaces', s: made.id } });
    },
    onSettled: refresh,
  });
  if (spaces.isLoading) return <Skeleton className="h-40" />;
  const all = spaces.data ?? [];
  const space =
    all.find((one) => one.id === chosen) ?? all.find((one) => one.id === me.space.id) ?? all[0];
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Panel title="Tes espaces" icon={<Users size={16} />}>
        {all.map((one) => (
          <button
            key={one.id}
            onClick={() => void navigate({ to: '/reglages', search: { t: 'espaces', s: one.id } })}
            className={
              rowClass +
              ' w-full cursor-pointer text-left ' +
              (one.id === space?.id ? 'bg-sand' : '')
            }
          >
            <SpaceDot color={spaceColor(one)} />
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">{one.name}</b>
              <span className="block truncate text-[12.5px] text-bark">
                {one.personal ? 'à toi seule' : `${one.members.length} membre(s)`}
              </span>
            </span>
            <Tag tone="neutral" dot={false}>
              {ROLES.find((r) => r.value === one.role)?.label ?? one.role}
            </Tag>
          </button>
        ))}
        <form
          className="flex gap-2 border-t border-rule px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nouvel espace partagé (Famille…)"
            aria-label="Nom du nouvel espace"
          />
          <Button tone="solid" disabled={!name.trim() || create.isPending}>
            Créer
          </Button>
        </form>
      </Panel>
      {space && <SpaceDetail key={space.id} space={space} refresh={refresh} />}
    </div>
  );
}

function SpaceDetail({ space, refresh }: { space: SpaceFull; refresh: () => void }) {
  const { me, colorOf: spaceColor } = useSession();
  const client = useQueryClient();
  const owner = space.role === 'owner';
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? '');
  const [color, setColor] = useState(space.color ?? '');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const invitations = useQuery({
    queryKey: ['spaces', space.id, 'invitations'],
    queryFn: () => api<Invitation[]>(`/spaces/${space.id}/invitations`),
    enabled: owner && !space.personal,
  });
  const saveSpace = useMutation({
    mutationFn: () =>
      api(`/spaces/${space.id}`, {
        method: 'PATCH',
        body: { name, description: description || null, color: color || null },
      }),
    onSettled: refresh,
  });
  const invite = useMutation({
    mutationFn: () =>
      api<{ link: string }>(`/spaces/${space.id}/invitations`, { method: 'POST', body: { email } }),
    onSuccess: (made) => {
      setLink(made.link);
      setEmail('');
    },
    onSettled: () =>
      void client.invalidateQueries({ queryKey: ['spaces', space.id, 'invitations'] }),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api(`/spaces/${space.id}/invitations/${id}`, { method: 'DELETE' }),
    onSettled: () =>
      void client.invalidateQueries({ queryKey: ['spaces', space.id, 'invitations'] }),
  });
  const role = useMutation({
    mutationFn: ({ person, value }: { person: string; value: Member['role'] }) =>
      api(`/spaces/${space.id}/members/${person}/role`, { method: 'POST', body: { role: value } }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (person: string) =>
      api(`/spaces/${space.id}/members/${person}`, { method: 'DELETE' }),
    onSettled: refresh,
  });
  // What a member sees (v3 F7): every kind, or those the owner opens her.
  const [choosing, setChoosing] = useState<{ person: string; kinds: string[] } | null>(null);
  const spaceKinds = useQuery({
    queryKey: ['kinds', space.id],
    queryFn: () => api<{ kind: string; count: number }[]>('/kinds', { space: space.id }),
    enabled: owner && !space.personal,
  });
  const kindName = useKindName();
  const sees = useMutation({
    mutationFn: ({ one, kinds }: { one: Member; kinds: string[] | null }) =>
      api(`/spaces/${space.id}/members/${one.person}/role`, {
        method: 'POST',
        body: { role: one.role, kinds },
      }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => setChoosing(null),
    onSettled: refresh,
  });
  // Who works by itself here (v3 F7): its agents, beside the people.
  const agents = useQuery({
    queryKey: ['agents', space.id],
    queryFn: () => api<SpaceAgent[]>('/agents', { space: space.id }),
  });
  const here = useSession().space.id === space.id;
  const changed =
    name !== space.name ||
    description !== (space.description ?? '') ||
    color !== (space.color ?? '');
  const open = (invitations.data ?? []).filter((one) => one.state === 'open');
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel title={space.name} icon={<SpaceDot color={spaceColor(space)} />}>
        <div className="grid gap-3 px-4 py-3">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Nom</span>
            <input
              className={inputClass}
              value={name}
              disabled={!owner}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold">À quoi il sert</span>
            <input
              className={inputClass}
              value={description}
              disabled={!owner}
              maxLength={280}
              placeholder="Ce qu’on y garde, ensemble"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-semibold">Couleur</span>
            <span className="flex flex-wrap gap-1.5">
              {SWATCHES.map((one) => (
                <button
                  key={one}
                  type="button"
                  disabled={!owner}
                  aria-label={`Couleur ${one}`}
                  aria-pressed={color === one}
                  onClick={() => setColor(one)}
                  className={
                    'h-7 w-7 cursor-pointer rounded-[2px] border-2 ' +
                    (color === one ? 'border-ink' : 'border-transparent')
                  }
                  style={{ background: one }}
                />
              ))}
            </span>
          </div>
          {owner && (
            <span>
              <Button
                tone="solid"
                disabled={!changed || saveSpace.isPending}
                onClick={() => saveSpace.mutate()}
              >
                Enregistrer
              </Button>
            </span>
          )}
        </div>
      </Panel>
      <Panel title="Membres" icon={<ShieldCheck size={16} />}>
        {space.personal && (
          <p className="border-b border-rule px-4 py-3 text-[13px] text-bark">
            Ton espace à toi : personne n’y est jamais invité. Pour partager, crée un espace
            partagé.
          </p>
        )}
        {space.members.map((one) => {
          const self = one.person === me.person.id;
          const shown = one.name ?? (self ? me.person.name : 'Un membre');
          return (
            <div key={one.person} className={rowClass + ' flex-wrap'}>
              <Avatar name={shown} size={30} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">
                  {shown}
                  {self ? ' (toi)' : ''}
                </b>
                <span className="block truncate text-[12.5px] text-bark">
                  depuis {ago(one.since)}
                  {one.role !== 'owner' && !space.personal && (
                    <>
                      {' · voit '}
                      {one.kinds?.length
                        ? one.kinds.map((kind) => kindName(kind)).join(', ')
                        : 'tout'}
                    </>
                  )}
                </span>
              </span>
              {owner && !self && !space.personal ? (
                <select
                  className={inputClass.replace('w-full', 'w-auto')}
                  value={one.role}
                  aria-label={`Rôle de ${shown}`}
                  onChange={(e) =>
                    role.mutate({ person: one.person, value: e.target.value as Member['role'] })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.lead}
                    </option>
                  ))}
                </select>
              ) : (
                <Tag tone="neutral" dot={false}>
                  {ROLES.find((r) => r.value === one.role)?.label ?? one.role}
                </Tag>
              )}
              {owner && !self && !space.personal && one.role !== 'owner' && (
                <Button
                  size="sm"
                  aria-expanded={choosing?.person === one.person}
                  onClick={() =>
                    setChoosing(
                      choosing?.person === one.person
                        ? null
                        : { person: one.person, kinds: one.kinds ?? [] },
                    )
                  }
                >
                  Ce qu’il voit
                </Button>
              )}
              {!space.personal && (owner || self) && (
                <Button
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        self
                          ? `Quitter « ${space.name} » ?`
                          : `Retirer ${shown} de « ${space.name} » ?`,
                      )
                    )
                      remove.mutate(self ? 'me' : one.person);
                  }}
                >
                  {self ? 'Quitter' : 'Retirer'}
                </Button>
              )}
              {choosing?.person === one.person && (
                <form
                  className="grid w-full gap-2 border-t border-rule pt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sees.mutate({ one, kinds: choosing.kinds.length ? choosing.kinds : null });
                  }}
                >
                  <span className="text-[12.5px] text-bark">
                    Ce que {shown} voit et écrit ici. Rien de coché : tout. Le reste lui est caché
                    par la base elle-même, avec ses liens et son journal.
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {(spaceKinds.data ?? [])
                      .filter((kind) => kind.count > 0 && !STRUCTURE.has(kind.kind.toLowerCase()))
                      .map((kind) => (
                        <label key={kind.kind} className="flex items-center gap-1.5 text-[13.5px]">
                          <input
                            type="checkbox"
                            aria-label={kindName(kind.kind)}
                            checked={choosing.kinds.includes(kind.kind)}
                            onChange={(event) =>
                              setChoosing({
                                ...choosing,
                                kinds: event.target.checked
                                  ? [...choosing.kinds, kind.kind]
                                  : choosing.kinds.filter((k) => k !== kind.kind),
                              })
                            }
                          />
                          {kindName(kind.kind)}
                          <span className="font-mono text-[11px] text-faint">{kind.count}</span>
                        </label>
                      ))}
                  </span>
                  <span className="flex gap-2">
                    <Button size="sm" tone="solid" disabled={sees.isPending}>
                      {choosing.kinds.length ? 'Ouvrir ces types seulement' : 'Tout ouvrir'}
                    </Button>
                    <Button size="sm" type="button" onClick={() => setChoosing(null)}>
                      Annuler
                    </Button>
                  </span>
                </form>
              )}
            </div>
          );
        })}
        {(agents.data ?? []).map((agent) => (
          <div key={`agent:${agent.title}`} className={rowClass + ' flex-wrap'}>
            <Avatar name={agent.title} size={30} tinted />
            <span className="min-w-0 flex-1">
              {here ? (
                <Link
                  to="/construire/agents/$name"
                  params={{ name: agent.title }}
                  className="block truncate font-semibold hover:underline"
                >
                  {agent.title}
                </Link>
              ) : (
                <b className="block truncate font-semibold">{agent.title}</b>
              )}
              <span className="block truncate text-[12.5px] text-bark">
                {agent.data.role ?? 'agent'}
              </span>
            </span>
            <Tag tone="neutral" dot={false}>
              agent · {AGENT_STATE[agent.state] ?? agent.state}
            </Tag>
          </div>
        ))}
      </Panel>
      {owner && !space.personal && (
        <Panel title="Inviter" icon={<MailPlus size={16} />}>
          <form
            className="flex flex-wrap gap-2 px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (email.includes('@')) invite.mutate();
            }}
          >
            <input
              type="email"
              className={inputClass + ' flex-1'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="son adresse e-mail"
              aria-label="Adresse de la personne invitée"
            />
            <Button tone="solid" disabled={!email.includes('@') || invite.isPending}>
              Créer l’invitation
            </Button>
          </form>
          {link && (
            <div className="border-t border-rule px-4 py-3 text-[13px]">
              <p className="mb-1.5 text-bark">
                Jarvis n’envoie rien : donne-lui ce lien (valable 14 jours).
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  className={inputClass + ' font-mono text-xs'}
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
                <Button size="sm" onClick={() => void navigator.clipboard?.writeText(link)}>
                  Copier
                </Button>
              </div>
            </div>
          )}
          {open.map((one) => (
            <div key={one.id} className={rowClass}>
              <span className="min-w-0 flex-1 truncate">{one.email}</span>
              <span className="flex-none text-[12.5px] text-bark">
                jusqu’au {new Date(one.expiresAt).toLocaleDateString('fr')}
              </span>
              <Button
                size="sm"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate(one.id)}
              >
                Retirer
              </Button>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

interface Connector {
  id: string;
  name: string;
  url: string;
  protocol: 'mcp' | 'http' | 'api';
  provider: string | null;
  state: 'unchecked' | 'connected' | 'refused' | 'unreachable' | 'needs_sign_in';
  reason: string | null;
  failures: number;
  lastOkAt: string | null;
  checkedAt: string | null;
  serverName: string | null;
  tools: unknown[];
}
interface Provider {
  id: string;
  name: string;
  family: string;
  auth: string;
  description?: string | { fr?: string; en?: string };
  needsAddress: boolean;
}
const STATE: Record<Connector['state'], { label: string; tone: TagTone }> = {
  connected: { label: 'connecté', tone: 'ok' },
  needs_sign_in: { label: 'à reconnecter', tone: 'late' },
  unreachable: { label: 'injoignable', tone: 'error' },
  refused: { label: 'refusé', tone: 'error' },
  unchecked: { label: 'pas encore vérifié', tone: 'neutral' },
};
/** A provider's site, for its logo. */
const PROVIDER_DOMAIN: Record<string, string> = {
  'google-calendar': 'calendar.google.com',
  'google-drive': 'drive.google.com',
};
const words = (one?: Provider['description']) =>
  !one ? '' : typeof one === 'string' ? one : (one.fr ?? one.en ?? '');

function Connections() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ['connectors'],
    queryFn: () => api<Connector[]>('/connectors'),
  });
  const providers = useQuery({
    queryKey: ['connections', 'providers'],
    queryFn: () => api<Provider[]>('/connections/providers'),
  });
  const [adding, setAdding] = useState<Provider | null>(null);
  const [url, setUrl] = useState('');
  const refresh = () => void client.invalidateQueries({ queryKey: ['connectors'] });
  const check = useMutation({
    mutationFn: (id: string) => api(`/connectors/${id}/check`, { method: 'POST' }),
    onSettled: refresh,
  });
  const sync = useMutation({
    mutationFn: (id: string) => api(`/connections/${id}/sync`, { method: 'POST' }),
    onSettled: () => {
      refresh();
      void client.invalidateQueries({ queryKey: ['now'] });
    },
  });
  const signIn = useMutation({
    mutationFn: (id: string) =>
      api<{ url: string }>(`/connections/${id}/sign-in`, { method: 'POST' }),
    onSuccess: (made) => {
      location.href = made.url;
    },
  });
  const cut = useMutation({
    mutationFn: (id: string) => api(`/connectors/${id}`, { method: 'DELETE' }),
    onSettled: refresh,
  });
  const connect = useMutation({
    mutationFn: (provider: Provider) =>
      api<{ signIn?: string }>('/connections', {
        method: 'POST',
        body: { provider: provider.id, ...(url ? { url } : {}) },
      }),
    onSuccess: (made) => {
      setAdding(null);
      setUrl('');
      if (made.signIn) location.href = made.signIn;
    },
    onSettled: refresh,
  });
  const mine = list.data ?? [];
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title="Tes connexions" icon={<Plug size={16} />}>
        {list.isLoading ? (
          <Skeleton className="m-4 h-16" />
        ) : !mine.length ? (
          <Empty
            title="Aucune connexion"
            lead="Relie un agenda, ton Drive ou un serveur d’outils : à droite."
          />
        ) : (
          mine.map((one) => {
            const state = STATE[one.state] ?? STATE.unchecked;
            const domain = PROVIDER_DOMAIN[one.provider ?? ''] ?? null;
            return (
              <div key={one.id} className={rowClass + ' flex-wrap'}>
                <Logo name={one.name} domain={domain} size={30} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{one.name}</b>
                  <span className="block truncate text-[12.5px] text-bark">
                    {one.protocol === 'mcp'
                      ? `outils d’un serveur · ${one.tools.length} outil(s)`
                      : one.provider === 'ics'
                        ? 'agenda suivi'
                        : (one.serverName ?? one.provider ?? one.url)}
                    {one.lastOkAt ? ` · a répondu ${ago(one.lastOkAt)}` : ''}
                    {one.failures > 0 ? ` · ${one.failures} échec(s) de suite` : ''}
                  </span>
                  {one.state !== 'connected' && one.reason && (
                    <span className="block truncate text-[12px] text-error" title={one.reason}>
                      {one.reason}
                    </span>
                  )}
                </span>
                <Tag tone={state.tone}>{state.label}</Tag>
                <span className="flex flex-none flex-wrap gap-1.5">
                  {one.state === 'needs_sign_in' && one.protocol === 'api' && (
                    <Button
                      size="sm"
                      tone="solid"
                      disabled={signIn.isPending}
                      onClick={() => signIn.mutate(one.id)}
                    >
                      Se reconnecter
                    </Button>
                  )}
                  {one.provider === 'ics' && (
                    <Button size="sm" disabled={sync.isPending} onClick={() => sync.mutate(one.id)}>
                      <CalendarSync size={14} />
                      Relire
                    </Button>
                  )}
                  <Button size="sm" disabled={check.isPending} onClick={() => check.mutate(one.id)}>
                    <RefreshCw size={14} />
                    Vérifier
                  </Button>
                  <Button
                    size="sm"
                    disabled={cut.isPending}
                    onClick={() => {
                      if (confirm(`Couper « ${one.name} » ? Ce qu’elle a apporté reste chez toi.`))
                        cut.mutate(one.id);
                    }}
                  >
                    Couper
                  </Button>
                </span>
              </div>
            );
          })
        )}
        <p className="border-t border-rule px-4 py-3 text-xs text-faint">
          Jarvis vérifie chaque connexion tous les jours : celle qui ne répond plus apparaît dans «
          À régler ». Les secrets restent chiffrés côté serveur.
        </p>
      </Panel>
      <Panel title="Relier un service" icon={<Link2 size={16} />}>
        {(providers.data ?? []).map((one) => (
          <div key={one.id} className="border-b border-rule px-4 py-3 last:border-0">
            <div className="flex items-center gap-3">
              <Logo name={one.name} domain={PROVIDER_DOMAIN[one.id] ?? null} size={30} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{one.name}</b>
                <span className="line-clamp-2 text-[12.5px] text-bark">
                  {words(one.description)}
                </span>
              </span>
              {adding?.id !== one.id && (
                <Button
                  size="sm"
                  onClick={() => (one.needsAddress ? setAdding(one) : connect.mutate(one))}
                  disabled={connect.isPending}
                >
                  Relier
                </Button>
              )}
            </div>
            {adding?.id === one.id && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (url.trim()) connect.mutate(one);
                }}
              >
                <input
                  className={inputClass}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://… (l’adresse de l’agenda)"
                  aria-label={`Adresse pour ${one.name}`}
                />
                <Button tone="solid" disabled={!url.trim() || connect.isPending}>
                  Relier
                </Button>
              </form>
            )}
          </div>
        ))}
        {connect.error && (
          <p className="px-4 py-2 text-[13px] text-error">{(connect.error as Error).message}</p>
        )}
      </Panel>
      <ToolServers />
    </div>
  );
}

interface CatalogServer {
  name: string;
  url: string;
  auth: 'none' | 'bearer' | 'oauth';
  description?: string | { fr?: string; en?: string };
  ready: boolean;
}

/**
 * A server of tools (MCP, spec 025): one from the catalogue, or any by its address and key. Its
 * tools then answer through Jarvis; what changes, sends or deletes still asks her first.
 */
function ToolServers() {
  const client = useQueryClient();
  const catalog = useQuery({
    queryKey: ['connectors', 'catalog'],
    queryFn: () => api<CatalogServer[]>('/connectors/catalog'),
  });
  const [own, setOwn] = useState<{ name: string; url: string; secret: string } | null>(null);
  const add = useMutation({
    mutationFn: (input: { name: string; url: string; auth: string; secret?: string }) =>
      api<{ signIn?: string }>('/connectors', { method: 'POST', body: input }),
    onSuccess: (made) => {
      if (made.signIn) window.location.href = made.signIn;
      else {
        toast('Serveur relié : ses outils sont dans tes connexions.');
        setOwn(null);
      }
    },
    onError: (error) => toast((error as Error).message, 'error'),
    onSettled: () => void client.invalidateQueries({ queryKey: ['connectors'] }),
  });
  const said = (text: CatalogServer['description']) =>
    typeof text === 'string' ? text : (text?.fr ?? text?.en ?? '');
  return (
    <Panel title="Un serveur d’outils (MCP)" icon={<Plug size={16} />}>
      {(catalog.data ?? []).map((one) => (
        <div key={one.url} className={rowClass}>
          <Logo name={one.name} domain={null} size={28} />
          <span className="min-w-0 flex-1">
            <b className="block truncate font-semibold">{one.name}</b>
            <span className="line-clamp-2 text-[12.5px] text-bark">{said(one.description)}</span>
          </span>
          <Button
            size="sm"
            disabled={!one.ready || add.isPending}
            title={one.ready ? undefined : 'Pas encore disponible sur ce serveur'}
            onClick={() => add.mutate({ name: one.name, url: one.url, auth: one.auth })}
          >
            Relier
          </Button>
        </div>
      ))}
      {own === null ? (
        <div className="px-4 py-3">
          <Button size="sm" onClick={() => setOwn({ name: '', url: '', secret: '' })}>
            Un autre, par son adresse
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-2 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate({
              name: own.name.trim(),
              url: own.url.trim(),
              auth: own.secret ? 'bearer' : 'none',
              ...(own.secret ? { secret: own.secret } : {}),
            });
          }}
        >
          <input
            className={inputClass}
            aria-label="Nom du serveur"
            placeholder="Son nom (Notion, mon serveur…)"
            value={own.name}
            onChange={(event) => setOwn({ ...own, name: event.target.value })}
          />
          <input
            className={inputClass}
            aria-label="Adresse du serveur"
            placeholder="https://… /mcp"
            value={own.url}
            onChange={(event) => setOwn({ ...own, url: event.target.value })}
          />
          <input
            className={inputClass}
            type="password"
            aria-label="Clé du serveur"
            placeholder="Sa clé, s’il en demande une"
            value={own.secret}
            onChange={(event) => setOwn({ ...own, secret: event.target.value })}
          />
          <span className="flex gap-2">
            <Button
              size="sm"
              tone="solid"
              disabled={!own.name.trim() || !/^https?:\/\//.test(own.url.trim()) || add.isPending}
            >
              Relier
            </Button>
            <Button size="sm" type="button" onClick={() => setOwn(null)}>
              Annuler
            </Button>
          </span>
        </form>
      )}
    </Panel>
  );
}

interface AssistantAccess {
  clientId: string;
  name: string | null;
  since: string;
  used: string | null;
}
interface PersonalKey {
  id: string;
  name: string;
  spaceId: string | null;
  kinds: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * The spaces an assistant reaches (spec 004): chosen at consent, changed here. At least one; what
 * it does not reach, it neither reads nor writes.
 */
function ClientSpaces({
  clientId,
  name,
  onDone,
}: {
  clientId: string;
  name: string;
  onDone: () => void;
}) {
  const { me } = useSession();
  const client = useQueryClient();
  const reached = useQuery({
    queryKey: ['assistants', clientId, 'spaces'],
    queryFn: () => api<Space[]>(`/clients/${encodeURIComponent(clientId)}/spaces`),
  });
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? (reached.data ?? []).map((one) => one.id);
  const save = useMutation({
    mutationFn: () =>
      api(`/clients/${encodeURIComponent(clientId)}/spaces`, {
        method: 'PUT',
        body: { spaces: chosen },
      }),
    onError: (error) => toast((error as Error).message, 'error'),
    onSuccess: () => {
      toast(`${name} atteint maintenant ${chosen.length} espace(s).`);
      onDone();
    },
    onSettled: () =>
      void client.invalidateQueries({ queryKey: ['assistants', clientId, 'spaces'] }),
  });
  if (reached.isLoading) return <Skeleton className="h-16 w-full" />;
  return (
    <form
      className="grid w-full gap-2 border-t border-rule pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen.length) save.mutate();
      }}
    >
      <span className="text-[12.5px] text-bark">
        Ce que {name} peut lire et écrire. Ce qu’il n’atteint pas lui reste fermé.
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-1.5">
        {me.spaces.map((space) => (
          <label key={space.id} className="flex items-center gap-1.5 text-[13.5px]">
            <input
              type="checkbox"
              aria-label={space.name}
              checked={chosen.includes(space.id)}
              onChange={(event) =>
                setPicked(
                  event.target.checked
                    ? [...chosen, space.id]
                    : chosen.filter((one) => one !== space.id),
                )
              }
            />
            {space.personal ? `${space.name} (ton espace à toi)` : space.name}
          </label>
        ))}
      </span>
      {!chosen.length && (
        <span className="text-[12.5px] text-error">Choisis au moins un espace.</span>
      )}
      <span className="flex gap-2">
        <Button size="sm" tone="solid" disabled={!chosen.length || save.isPending}>
          Garder
        </Button>
        <Button size="sm" type="button" onClick={onDone}>
          Annuler
        </Button>
      </span>
    </form>
  );
}

function Assistants() {
  const { me } = useSession();
  const client = useQueryClient();
  const access = useQuery({
    queryKey: ['assistants'],
    queryFn: () => api<AssistantAccess[]>('/connections'),
  });
  const keys = useQuery({
    queryKey: ['me', 'keys'],
    queryFn: () => api<PersonalKey[]>('/me/keys'),
  });
  const [name, setName] = useState('');
  const [made, setMade] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const cutAccess = useMutation({
    mutationFn: (id: string) => api(`/connections/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['assistants'] }),
  });
  const createKey = useMutation({
    mutationFn: () => api<{ key: string }>('/me/keys', { method: 'POST', body: { name } }),
    onSuccess: (one) => {
      setMade(one.key);
      setName('');
    },
    onSettled: () => void client.invalidateQueries({ queryKey: ['me', 'keys'] }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/me/keys/${id}`, { method: 'DELETE' }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['me', 'keys'] }),
  });
  const spaceName = (id: string | null) =>
    id ? (me.spaces.find((one) => one.id === id)?.name ?? 'un espace') : 'tous tes espaces';
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title="Assistants reliés" icon={<Bot size={16} />}>
        {!(access.data ?? []).length ? (
          <Empty
            title="Aucun assistant relié"
            lead="Ajoute Jarvis comme connecteur dans Claude, ChatGPT ou un autre : il apparaîtra ici."
          />
        ) : (
          (access.data ?? []).map((one) => (
            <div key={one.clientId} className={rowClass + ' flex-wrap'}>
              <Avatar name={one.name ?? 'Assistant'} size={30} tinted />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{one.name ?? 'Assistant'}</b>
                <span className="block truncate text-[12.5px] text-bark">
                  relié {ago(one.since)}
                  {one.used ? ` · dernier passage ${ago(one.used)}` : ''}
                </span>
              </span>
              <Button
                size="sm"
                aria-expanded={choosing === one.clientId}
                onClick={() => setChoosing(choosing === one.clientId ? null : one.clientId)}
              >
                Ses espaces
              </Button>
              <Button
                size="sm"
                disabled={cutAccess.isPending}
                onClick={() => {
                  if (confirm(`Retirer l’accès de « ${one.name ?? 'cet assistant'} » ?`))
                    cutAccess.mutate(one.clientId);
                }}
              >
                Retirer l’accès
              </Button>
              {choosing === one.clientId && (
                <ClientSpaces
                  clientId={one.clientId}
                  name={one.name ?? 'Cet assistant'}
                  onDone={() => setChoosing(null)}
                />
              )}
            </div>
          ))
        )}
      </Panel>
      <Panel title="Clés personnelles" icon={<KeyRound size={16} />}>
        <form
          className="flex gap-2 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            createKey.mutate();
          }}
        >
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="À quoi elle sert (un script, un raccourci…)"
            aria-label="Nom de la clé"
          />
          <Button tone="solid" disabled={createKey.isPending}>
            Créer
          </Button>
        </form>
        {made && (
          <div className="border-t border-rule px-4 py-3 text-[13px]">
            <p className="mb-1.5 text-bark">Copie-la maintenant : elle ne sera plus montrée.</p>
            <div className="flex gap-2">
              <input
                readOnly
                className={inputClass + ' font-mono text-xs'}
                value={made}
                onFocus={(e) => e.target.select()}
              />
              <Button size="sm" onClick={() => void navigator.clipboard?.writeText(made)}>
                Copier
              </Button>
            </div>
          </div>
        )}
        {(keys.data ?? []).map((one) => (
          <div key={one.id} className={rowClass + ' border-t'}>
            <KeyRound size={15} className="flex-none text-bark" />
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">{one.name || 'Clé sans nom'}</b>
              <span className="block truncate text-[12.5px] text-bark">
                {spaceName(one.spaceId)} · créée {ago(one.createdAt)}
                {one.lastUsedAt ? ` · utilisée ${ago(one.lastUsedAt)}` : ' · jamais utilisée'}
              </span>
            </span>
            <Button size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(one.id)}>
              Révoquer
            </Button>
          </div>
        ))}
      </Panel>
    </div>
  );
}
