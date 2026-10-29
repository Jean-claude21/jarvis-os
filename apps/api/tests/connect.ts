import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Space } from '@jarvis-os/core';
import { mcpServerFor } from '../src/mcp';
import { PUBLIC_URL, server, type Account } from './client';

export interface Connected {
  client: Client;
  call: <T = unknown>(
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ value: T; isError: boolean }>;
}

/**
 * Her MCP server in memory, as the OAuth client `clientId` reaches it: the spaces she allowed it
 * (her own only, until she allows more). The OAuth flow has its own test.
 */
export async function connect(account: Account, clientId = 'test'): Promise<Connected> {
  const me = await account.json<{ person: { id: string; name: string; email: string } }>('/api/me');
  const spaces = await account.json<Space[]>(`/api/clients/${clientId}/spaces`);
  const mcp = await mcpServerFor(
    { db: server.db, blobs: server.blobs, publicUrl: PUBLIC_URL, today: () => '2026-10-29' },
    {
      person: me.body.person.id,
      name: me.body.person.name,
      email: me.body.person.email,
      spaces: spaces.body,
      clientId,
      client: 'test',
    },
  );
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: 'jarvis-test', version: '1.0.0' });
  await client.connect(clientSide);
  const call = async <T>(name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      content: { text: string }[];
      isError?: boolean;
    };
    return { value: JSON.parse(result.content[0]!.text) as T, isError: result.isError === true };
  };
  return { client, call };
}
