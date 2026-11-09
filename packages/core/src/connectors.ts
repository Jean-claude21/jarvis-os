import type { Actor, Tx } from './db';
import { prefixedId } from './ids';
import { record } from './journal';

// Her connectors (spec 025): a door from one of her spaces to another tool's server. The core keeps
// them and journals what changes; it never sees a secret in clear (the server seals it) and names
// no protocol: reaching the tool is the doors' work.

export type ConnectorAuth = 'none' | 'bearer' | 'header' | 'oauth';
export type ConnectorState =
  'unchecked' | 'connected' | 'refused' | 'unreachable' | 'needs_sign_in';

export interface ConnectorTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  /** The server's own hints: read only, destructive, reaching the outside world. */
  annotations?: Record<string, unknown>;
}

export interface Connector {
  id: string;
  spaceId: string;
  name: string;
  url: string;
  auth: ConnectorAuth;
  headerName: string | null;
  /** Whether a secret is kept: never the secret itself. */
  hasSecret: boolean;
  state: ConnectorState;
  reason: string | null;
  serverName: string | null;
  tools: ConnectorTool[];
  resources: { uri: string; name?: string; mimeType?: string }[];
  checkedAt: string | null;
  createdAt: string;
}

/** What a check read from the server. */
export interface Probe {
  state: ConnectorState;
  reason: string | null;
  serverName: string | null;
  tools: ConnectorTool[];
  resources: Connector['resources'];
}

const columns = `id, space_id, name, url, auth, header_name, secret_sealed is not null as has_secret,
  state, reason, server_name, tools, resources, checked_at, created_at`;

const connectorOf = (row: Record<string, unknown>): Connector => ({
  id: String(row.id),
  spaceId: String(row.space_id),
  name: String(row.name),
  url: String(row.url),
  auth: row.auth as ConnectorAuth,
  headerName: (row.header_name as string | null) ?? null,
  hasSecret: row.has_secret === true,
  state: row.state as ConnectorState,
  reason: (row.reason as string | null) ?? null,
  serverName: (row.server_name as string | null) ?? null,
  tools: (row.tools as ConnectorTool[]) ?? [],
  resources: (row.resources as Connector['resources']) ?? [],
  checkedAt: row.checked_at ? new Date(row.checked_at as string).toISOString() : null,
  createdAt: new Date(row.created_at as string).toISOString(),
});

/** What the journal keeps of a connector: never its secret. */
const traceOf = (one: Connector) => ({
  name: one.name,
  url: one.url,
  auth: one.auth,
  headerName: one.headerName,
  hasSecret: one.hasSecret,
});

export async function addConnector(
  tx: Tx,
  actor: Actor,
  input: {
    spaceId: string;
    name: string;
    url: string;
    auth: ConnectorAuth;
    headerName?: string | null;
    sealed?: string | null;
  },
): Promise<Connector> {
  const { rows } = await tx.query(
    `insert into connector (id, space_id, name, url, auth, header_name, secret_sealed, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${columns}`,
    [
      prefixedId('con'),
      input.spaceId,
      input.name.trim(),
      input.url.trim(),
      input.auth,
      input.headerName ?? null,
      input.sealed ?? null,
      actor.person,
    ],
  );
  const made = connectorOf(rows[0]!);
  await record(tx, actor, {
    spaceId: made.spaceId,
    command: 'connector.add',
    target: made.id,
    before: null,
    after: traceOf(made),
  });
  return made;
}

/** The connectors of these spaces, without their secrets. */
export async function connectorsOf(tx: Tx, spaceIds: string[]): Promise<Connector[]> {
  const { rows } = await tx.query(
    `select ${columns} from connector where space_id = any($1) order by name, id`,
    [spaceIds],
  );
  return rows.map(connectorOf);
}

/** One connector and its sealed secret, for the door that reaches it. */
export async function connectorWithSecret(
  tx: Tx,
  id: string,
): Promise<{ connector: Connector; sealed: string | null; oauth: string | null } | null> {
  const { rows } = await tx.query(
    `select ${columns}, secret_sealed, oauth_sealed from connector where id = $1`,
    [id],
  );
  const row = rows[0];
  return row
    ? {
        connector: connectorOf(row),
        sealed: (row.secret_sealed as string | null) ?? null,
        oauth: (row.oauth_sealed as string | null) ?? null,
      }
    : null;
}

/** What Jarvis keeps of her sign-in to the server (spec 025, US4), sealed by the server. */
export async function setOAuth(tx: Tx, id: string, sealed: string | null): Promise<void> {
  await tx.query('update connector set oauth_sealed = $2 where id = $1', [id, sealed]);
}

/** What a check read, kept so that listing her tools needs no call. */
export async function setProbe(tx: Tx, id: string, probe: Probe, at = new Date()): Promise<void> {
  await tx.query(
    `update connector set state = $2, reason = $3, server_name = $4, tools = $5, resources = $6,
       checked_at = $7 where id = $1`,
    [
      id,
      probe.state,
      probe.reason,
      probe.serverName,
      JSON.stringify(probe.tools),
      JSON.stringify(probe.resources),
      at.toISOString(),
    ],
  );
}

/** A new name, address or secret; journaled without the secret. */
export async function changeConnector(
  tx: Tx,
  actor: Actor,
  id: string,
  change: {
    name?: string;
    url?: string;
    auth?: ConnectorAuth;
    headerName?: string | null;
    sealed?: string | null;
  },
): Promise<Connector> {
  const before = await connectorWithSecret(tx, id);
  if (!before) throw new Error(`No connector ${id}.`);
  const { rows } = await tx.query(
    `update connector set
       name = coalesce($2, name), url = coalesce($3, url), auth = coalesce($4, auth),
       header_name = case when $5::boolean then $6 else header_name end,
       secret_sealed = case when $7::boolean then $8 else secret_sealed end,
       state = case when $7::boolean or $3::text is not null then 'unchecked' else state end
     where id = $1 returning ${columns}`,
    [
      id,
      change.name?.trim() ?? null,
      change.url?.trim() ?? null,
      change.auth ?? null,
      change.headerName !== undefined,
      change.headerName ?? null,
      change.sealed !== undefined,
      change.sealed ?? null,
    ],
  );
  const after = connectorOf(rows[0]!);
  await record(tx, actor, {
    spaceId: after.spaceId,
    command: 'connector.change',
    target: id,
    before: traceOf(before.connector),
    after: { ...traceOf(after), keyReplaced: change.sealed !== undefined },
  });
  return after;
}

/** Cut: the connector and its secret are gone; the journal keeps that it existed. */
export async function cutConnector(tx: Tx, actor: Actor, id: string): Promise<void> {
  const before = await connectorWithSecret(tx, id);
  if (!before) throw new Error(`No connector ${id}.`);
  await tx.query('delete from connector where id = $1', [id]);
  await record(tx, actor, {
    spaceId: before.connector.spaceId,
    command: 'connector.cut',
    target: id,
    before: traceOf(before.connector),
    after: null,
  });
}

/** A call through a connector: which tool, whether it worked; never its arguments nor answer. */
export async function recordCall(
  tx: Tx,
  actor: Actor,
  connector: Connector,
  call: { tool: string; ok: boolean; agreed: boolean },
): Promise<void> {
  await record(tx, actor, {
    spaceId: connector.spaceId,
    command: 'connector.call',
    target: connector.id,
    before: null,
    after: { connector: connector.name, ...call },
  });
}
