import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import {
  asPerson,
  addConnector,
  connectorWithSecret,
  connectorsOf,
  recordCall,
  setOAuth,
  setProbe,
  type Actor,
  type Connector,
  type Probe,
  readIcs,
  save,
  zoneOf,
  type SaveInput,
} from '@jarvis-os/core';
import { open, seal } from './secrets';

// The relay (v3 D16): every call to a provider's API goes through here. It knows the providers
// (where they answer, how they are signed in to, how to check them), opens her key or her tokens
// only here, renews a Google token under a lock (never twice at once), waits and tries again when a
// provider says « later », measures each call and journals it — never its content nor a secret.

export type ProviderAuth = 'oauth2-google' | 'none';

export interface Provider {
  id: string;
  name: string;
  /** Sources are read, capacities do work, outputs act outside. */
  family: 'source' | 'capacity' | 'output';
  auth: ProviderAuth;
  /** Where its API answers; empty when she gives the address (an ICS calendar). */
  base: string;
  scopes?: string[];
  /** A light call that says whether it answers, relative to `base`. */
  probe: string;
  description: { fr: string; en: string };
}

export const PROVIDERS: Provider[] = [
  {
    id: 'google-calendar',
    name: 'Google Agenda',
    family: 'source',
    auth: 'oauth2-google',
    base: 'https://www.googleapis.com/calendar/v3/',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    probe: 'users/me/calendarList?maxResults=1',
    description: {
      fr: 'Tes agendas Google, lus par Jarvis (lecture seule).',
      en: 'Your Google calendars, read by Jarvis (read-only).',
    },
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    family: 'source',
    auth: 'oauth2-google',
    base: 'https://www.googleapis.com/drive/v3/',
    // Only the files she opens with Jarvis or that Jarvis creates: never her whole Drive.
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    probe: 'about?fields=user',
    description: {
      fr: 'Les fichiers que tu choisis de partager avec Jarvis, et ceux qu’il crée.',
      en: 'The files you choose to share with Jarvis, and those it creates.',
    },
  },
  {
    id: 'ics',
    name: 'Agenda ICS',
    family: 'source',
    auth: 'none',
    base: '',
    probe: '',
    description: {
      fr: 'Un agenda publié en iCalendar (emploi du temps, club, école) : son adresse suffit.',
      en: 'A calendar published as iCalendar (timetable, club, school): its address is enough.',
    },
  },
];

export const providerOf = (id: string | null | undefined) =>
  PROVIDERS.find((one) => one.id === id) ?? null;

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const CALL_MS = 20_000;
const STATE_MS = 15 * 60_000;

interface Tokens {
  access_token: string;
  refresh_token?: string;
  /** Milliseconds since the epoch. */
  expires_at: number;
}

export interface RelayDeps {
  db: pg.Pool;
  key: Buffer;
  publicUrl: string;
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
}

export interface RelayRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Relative to the provider's base. */
  path: string;
  body?: unknown;
}

/** A provider's answer, read. */
export interface RelayAnswer {
  status: number;
  ok: boolean;
  data: unknown;
  ms: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function relay(deps: RelayDeps) {
  const env = deps.env ?? process.env;
  const fetcher = deps.fetcher ?? fetch;
  const as = <T>(person: string, work: Parameters<typeof asPerson<T>>[2]) =>
    asPerson(deps.db, person, work);
  const callback = `${deps.publicUrl.replace(/\/$/, '')}/api/connections/oauth/callback`;
  const google = () => {
    const id = env.JARVIS_GOOGLE_CLIENT_ID?.trim();
    const secret = env.JARVIS_GOOGLE_CLIENT_SECRET?.trim();
    if (!id || !secret) throw new Error('This Jarvis has no Google client yet.');
    return { id, secret };
  };

  /** A new connection to a provider: added, then checked (or sent to sign in). */
  const connect = async (
    actor: Actor,
    spaceId: string,
    providerId: string,
    given: { name?: string; url?: string } = {},
  ): Promise<{ connection: Connector; signIn?: string }> => {
    const provider = providerOf(providerId);
    if (!provider) throw new Error(`No provider « ${providerId} ».`);
    let url = provider.base;
    if (!provider.base) {
      const asked = (given.url ?? '').trim().replace(/^webcal:/i, 'https:');
      if (!/^https:\/\//.test(asked)) throw new Error('Give the https address of the calendar.');
      url = asked;
    }
    // Google's sign-in needs this server's client: said before anything is added.
    if (provider.auth === 'oauth2-google') google();
    const made = await as(actor.person, (tx) =>
      addConnector(tx, actor, {
        spaceId,
        name: (given.name ?? provider.name).trim().slice(0, 80),
        url,
        auth: provider.auth === 'oauth2-google' ? 'oauth' : 'none',
        protocol: 'api',
        provider: provider.id,
      }),
    );
    if (provider.auth === 'oauth2-google')
      return { connection: made, signIn: signInUrl(actor.person, made.id, provider) };
    return { connection: await check(actor.person, made.id) };
  };

  /** Google's page where she agrees, for this connection. */
  const signInUrl = (person: string, id: string, provider: Provider) => {
    const state = seal(
      deps.key,
      JSON.stringify({ person, id, at: Date.now(), n: randomBytes(8).toString('hex') }),
    );
    const url = new URL(GOOGLE_AUTH);
    url.searchParams.set('client_id', google().id);
    url.searchParams.set('redirect_uri', callback);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', (provider.scopes ?? []).join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  };

  /** A sign-in again (the tokens were refused), for a connection she already has. */
  const signInAgain = async (person: string, id: string) => {
    const found = await as(person, (tx) => connectorWithSecret(tx, id));
    const provider = providerOf(found?.connector.provider);
    if (!found || !provider || provider.auth !== 'oauth2-google')
      throw new Error('This connection signs in no other way.');
    return signInUrl(person, id, provider);
  };

  const exchange = async (form: Record<string, string>): Promise<Tokens> => {
    const answer = await fetcher(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(CALL_MS),
    });
    const read = (await answer.json().catch(() => ({}))) as Record<string, unknown>;
    if (!answer.ok || typeof read.access_token !== 'string')
      throw new Error(`Google refused: ${String(read.error ?? answer.status)}`);
    return {
      access_token: read.access_token,
      ...(typeof read.refresh_token === 'string' ? { refresh_token: read.refresh_token } : {}),
      expires_at: Date.now() + Number(read.expires_in ?? 3600) * 1000,
    };
  };

  /** Back from Google: the code turned into tokens, kept sealed; then the connection is checked. */
  const finish = async (person: string, code: string, state: string): Promise<Connector> => {
    let said: { person: string; id: string; at: number };
    try {
      said = JSON.parse(open(deps.key, state)) as typeof said;
    } catch {
      throw new Error('This sign-in is not one Jarvis started.');
    }
    if (said.person !== person) throw new Error('This sign-in was started by someone else.');
    if (Date.now() - said.at > STATE_MS) throw new Error('This sign-in is too old: start again.');
    const { id, secret } = google();
    const tokens = await exchange({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: callback,
      grant_type: 'authorization_code',
    });
    await as(person, (tx) => setOAuth(tx, said.id, seal(deps.key, JSON.stringify(tokens))));
    return check(person, said.id);
  };

  /**
   * Her token, valid for one more minute at least. A renewal holds a lock on the connection for its
   * transaction: two calls at once renew once, the second reads what the first kept.
   */
  const tokenFor = async (person: string, id: string, force = false): Promise<string> =>
    as(person, async (tx) => {
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [id]);
      const found = await connectorWithSecret(tx, id);
      if (!found?.oauth) throw new Error('Not signed in yet.');
      const tokens = JSON.parse(open(deps.key, found.oauth)) as Tokens;
      if (!force && tokens.expires_at - Date.now() > 60_000) return tokens.access_token;
      if (!tokens.refresh_token) throw new Error('Sign in again: Google gave no renewal.');
      const { id: clientId, secret } = google();
      const renewed = await exchange({
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: secret,
        grant_type: 'refresh_token',
      });
      const kept: Tokens = {
        ...renewed,
        refresh_token: renewed.refresh_token ?? tokens.refresh_token,
      };
      await setOAuth(tx, id, seal(deps.key, JSON.stringify(kept)));
      return kept.access_token;
    });

  /** A call through the relay: signed, measured, tried again when the provider says « later ». */
  const call = async (
    actor: Actor,
    id: string,
    request: RelayRequest,
    journal = true,
  ): Promise<RelayAnswer> => {
    const found = await as(actor.person, (tx) => connectorWithSecret(tx, id));
    if (!found) throw new Error(`No connection ${id} in her spaces.`);
    const { connector } = found;
    const provider = providerOf(connector.provider);
    if (connector.protocol !== 'api' || !provider)
      throw new Error(`« ${connector.name} » is not reached through the relay.`);
    const base = provider.base || connector.url;
    const url = provider.base ? new URL(request.path.replace(/^\//, ''), base) : new URL(base);
    if (url.protocol !== 'https:') throw new Error('Jarvis calls https addresses only.');
    const method = request.method ?? 'GET';
    const started = Date.now();
    let answer: Response | null = null;
    let renewed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const headers: Record<string, string> = { accept: 'application/json, text/calendar, */*' };
      if (provider.auth === 'oauth2-google')
        headers.authorization = `Bearer ${await tokenFor(actor.person, id, renewed)}`;
      if (request.body !== undefined) headers['content-type'] = 'application/json';
      try {
        answer = await fetcher(url, {
          method,
          headers,
          ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
          signal: AbortSignal.timeout(CALL_MS),
          redirect: 'follow',
        });
      } catch (error) {
        if (attempt === 2)
          throw new Error(`« ${connector.name} » did not answer: ${(error as Error).message}`);
        await wait(1000 * 2 ** attempt);
        continue;
      }
      // A refused token is renewed once; « too many » or a server's trouble waits and tries again.
      if (answer.status === 401 && provider.auth === 'oauth2-google' && !renewed) {
        renewed = true;
        continue;
      }
      if (answer.status === 429 || answer.status >= 500) {
        if (attempt === 2) break;
        const after = Number(answer.headers.get('retry-after'));
        await wait(
          Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt, 8000),
        );
        continue;
      }
      break;
    }
    const ms = Date.now() - started;
    const type = answer!.headers.get('content-type') ?? '';
    const text = await answer!.text();
    let data: unknown = text;
    if (type.includes('json')) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (journal)
      await as(actor.person, (tx) =>
        recordCall(tx, actor, connector, {
          tool: `${method} ${url.pathname}`,
          ok: answer!.ok,
          agreed: true,
          ms,
          status: answer!.status,
        }),
      );
    return { status: answer!.status, ok: answer!.ok, data, ms };
  };

  /** Whether the connection answers, kept on it (its state, its failures in a row). */
  const check = async (person: string, id: string): Promise<Connector> => {
    const found = await as(person, (tx) => connectorWithSecret(tx, id));
    if (!found) throw new Error(`No connection ${id} in her spaces.`);
    const provider = providerOf(found.connector.provider);
    const read: Probe = {
      state: 'connected',
      reason: null,
      serverName: provider?.name ?? null,
      tools: [],
      resources: [],
    };
    if (!provider) {
      read.state = 'refused';
      read.reason = 'unknown provider';
    } else if (provider.auth === 'oauth2-google' && !found.oauth) {
      read.state = 'needs_sign_in';
    } else {
      try {
        const answer = await call(
          { person, door: 'watcher', client: 'health' },
          id,
          { path: provider.probe },
          false,
        );
        if (!answer.ok) {
          read.state = answer.status === 401 || answer.status === 403 ? 'needs_sign_in' : 'refused';
          read.reason = `HTTP ${answer.status}`;
        } else if (provider.id === 'ics' && !String(answer.data).includes('BEGIN:VCALENDAR')) {
          read.state = 'refused';
          read.reason = 'not an iCalendar';
        }
      } catch (error) {
        const said = (error as Error).message;
        read.state = /sign in|signed in/i.test(said) ? 'needs_sign_in' : 'unreachable';
        read.reason = said.slice(0, 300);
      }
    }
    return as(person, async (tx) => {
      await setProbe(tx, id, read);
      return (await connectorsOf(tx, [found.connector.spaceId])).find((one) => one.id === id)!;
    });
  };

  /**
   * An ICS source read again (v3 D16): its events from two weeks ago to six months ahead become
   * « Event » entries of her space — each known by its uid, so a class moved is updated, never
   * doubled. Written as read (« lu »), by the source.
   */
  const syncIcs = async (
    person: string,
    id: string,
  ): Promise<{ read: number; created: number; updated: number }> => {
    const found = await as(person, (tx) => connectorWithSecret(tx, id));
    if (!found || found.connector.provider !== 'ics') throw new Error('Not an ICS source.');
    const { connector } = found;
    const actor: Actor = { person, door: 'watcher', client: `source:${connector.name}` };
    const answer = await call(actor, id, { path: '' }, false);
    if (!answer.ok) throw new Error(`« ${connector.name} » answered ${answer.status}.`);
    const zone = await as(person, (tx) => zoneOf(tx));
    const from = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 183 * 86_400_000).toISOString();
    const events = readIcs(String(answer.data), zone).filter(
      (one) => one.start >= from.slice(0, one.allDay ? 10 : 24) && one.start <= to,
    );
    return as(person, async (tx) => {
      const { rows } = await tx.query<{
        id: string;
        uid: string;
        title: string;
        data: Record<string, unknown>;
      }>(
        `select id, data->>'uid' as uid, title, data from entry
          where space_id = $1 and archived_at is null and data->>'source_connection' = $2`,
        [connector.spaceId, id],
      );
      const known = new Map(rows.map((row) => [row.uid, row]));
      const entries: SaveInput['entries'] = [];
      let created = 0;
      let updated = 0;
      for (const one of events) {
        const data = {
          start: one.start,
          ...(one.end ? { end: one.end } : {}),
          ...(one.place ? { place: one.place } : {}),
          ...(one.description ? { note: one.description } : {}),
          uid: one.uid,
          source: connector.name,
          source_connection: id,
        };
        const was = known.get(one.uid);
        if (!was) {
          entries.push({ kind: 'Event', title: one.title.slice(0, 300), data, origin: 'read' });
          created += 1;
        } else if (
          was.title !== one.title.slice(0, 300) ||
          was.data.start !== data.start ||
          (was.data.end ?? null) !== (data.end ?? null) ||
          (was.data.place ?? null) !== (data.place ?? null)
        ) {
          entries.push({ id: was.id, title: one.title.slice(0, 300), data, origin: 'read' });
          updated += 1;
        }
      }
      for (let at = 0; at < entries.length; at += 200)
        await save(tx, actor, connector.spaceId, { entries: entries.slice(at, at + 200) });
      return { read: events.length, created, updated };
    });
  };

  return { connect, finish, signInAgain, call, check, syncIcs };
}
export type Relay = ReturnType<typeof relay>;
