import type { Connector, ConnectorTool, Probe } from '@jarvis-os/core';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Jarvis as an MCP client (spec 025): it reaches the servers of her connectors over HTTP (Streamable
// HTTP, else the older SSE), with her key or her sign-in (OAuth); a fresh client for each check or
// call, closed after.

/** How a connector reaches its server: headers (a key), or her sign-in (spec 025, US4). */
export interface Reach {
  headers: Record<string, string>;
  authProvider?: OAuthClientProvider;
}

const TIMEOUT_MS = 30_000;
const ANSWER_MAX_CHARS = 50_000;

/** The headers a connector sends: her key as a bearer token or in its own header. */
export function headersOf(connector: Connector, secret: string | null): Record<string, string> {
  if (!secret || connector.auth === 'none') return {};
  if (connector.auth === 'bearer') return { authorization: `Bearer ${secret}` };
  return { [connector.headerName ?? 'x-api-key']: secret };
}

async function connected(url: string, reach: Reach): Promise<Client> {
  const options = {
    requestInit: { headers: reach.headers },
    ...(reach.authProvider ? { authProvider: reach.authProvider } : {}),
  };
  const client = new Client({ name: 'jarvis-os', version: '0.5.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url), options), {
      timeout: TIMEOUT_MS,
    });
    return client;
  } catch (first) {
    // A refusal is the server's answer: no second transport changes it.
    if (refusal(first)) throw first;
    const older = new Client({ name: 'jarvis-os', version: '0.5.0' });
    await older.connect(new SSEClientTransport(new URL(url), options), { timeout: TIMEOUT_MS });
    return older;
  }
}

const refusal = (error: unknown) =>
  /\b(401|403)\b|unauthori[sz]ed|forbidden|invalid[_ ]token/i.test(
    String((error as Error)?.message),
  ) || (error as Error)?.name === 'UnauthorizedError';

/** A check: the server's name, tools and resources, or why it could not be read. */
export async function probe(url: string, reach: Reach): Promise<Probe> {
  let client: Client | null = null;
  try {
    client = await connected(url, reach);
    const tools: ConnectorTool[] = (
      await client.listTools(undefined, { timeout: TIMEOUT_MS })
    ).tools.map((tool) => ({
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: tool.inputSchema,
      ...(tool.annotations ? { annotations: tool.annotations as Record<string, unknown> } : {}),
    }));
    const resources = client.getServerCapabilities()?.resources
      ? (await client.listResources(undefined, { timeout: TIMEOUT_MS })).resources.map((one) => ({
          uri: one.uri,
          ...(one.name ? { name: one.name } : {}),
          ...(one.mimeType ? { mimeType: one.mimeType } : {}),
        }))
      : [];
    return {
      state: 'connected',
      reason: null,
      serverName: client.getServerVersion()?.name ?? null,
      tools,
      resources,
    };
  } catch (error) {
    const message = String((error as Error)?.message ?? error).slice(0, 300);
    return {
      state: refusal(error) ? (reach.authProvider ? 'needs_sign_in' : 'refused') : 'unreachable',
      reason: message,
      serverName: null,
      tools: [],
      resources: [],
    };
  } finally {
    await client?.close().catch(() => undefined);
  }
}

/** Words in a tool's name that say it writes, when the server gives no hints. */
const WRITES =
  /(^|_|-)(create|add|update|edit|delete|remove|send|post|pay|write|set|move|cancel)(_|-|$)/i;

/** Whether a tool needs her yes: it changes or deletes things, or reaches the outside world. */
export function needsAgreement(tool: ConnectorTool): boolean {
  const hints = tool.annotations ?? {};
  if (hints.readOnlyHint === true) return false;
  if (hints.destructiveHint === true || hints.openWorldHint === true) return true;
  if (Object.keys(hints).length === 0) return WRITES.test(tool.name);
  return false;
}

/** A tool called on the server; its answer framed as content from outside. */
export async function callTool(
  connector: Connector,
  reach: Reach,
  tool: string,
  args: Record<string, unknown>,
): Promise<{ from: string; isError: boolean; content: unknown }> {
  const client = await connected(connector.url, reach);
  try {
    const result = await client.callTool({ name: tool, arguments: args }, undefined, {
      timeout: TIMEOUT_MS,
    });
    let content: unknown = result.structuredContent ?? result.content;
    const text = JSON.stringify(content);
    if (text.length > ANSWER_MAX_CHARS) content = `${text.slice(0, ANSWER_MAX_CHARS)}…`;
    return { from: connector.name, isError: result.isError === true, content };
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** One of the server's resources (a file, a page), read; framed as content from outside. */
export async function readResource(
  connector: Connector,
  reach: Reach,
  uri: string,
): Promise<{ from: string; contents: unknown }> {
  const client = await connected(connector.url, reach);
  try {
    const { contents } = await client.readResource({ uri }, { timeout: TIMEOUT_MS });
    return {
      from: connector.name,
      contents: contents.map((one) =>
        'text' in one && typeof one.text === 'string' && one.text.length > ANSWER_MAX_CHARS
          ? { ...one, text: `${one.text.slice(0, ANSWER_MAX_CHARS)}…` }
          : one,
      ),
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}
