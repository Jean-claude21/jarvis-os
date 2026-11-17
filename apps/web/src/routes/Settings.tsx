import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Bot,
  CalendarSync,
  Download,
  KeyRound,
  Link2,
  MailPlus,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
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
}
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
                </span>
              </span>
              {owner && !self && !space.personal ? (
                <select
                  className={inputClass + ' w-auto'}
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
            </div>
          );
        })}
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
    </div>
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
            <div key={one.clientId} className={rowClass}>
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
                disabled={cutAccess.isPending}
                onClick={() => {
                  if (confirm(`Retirer l’accès de « ${one.name ?? 'cet assistant'} » ?`))
                    cutAccess.mutate(one.clientId);
                }}
              >
                Retirer l’accès
              </Button>
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
