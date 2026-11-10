import {
  asPerson,
  entriesToEmbed,
  keepVector,
  nearEntries,
  saidOfMany,
  VECTOR_DIMENSIONS,
  type Embedder,
} from '@jarvis-os/core';
import type pg from 'pg';

// Search by meaning (spec 028): the model that turns texts into vectors, chosen by whoever runs
// Jarvis — Voyage AI (`VOYAGE_API_KEY`, voyage-3.5-lite) or OpenAI (`OPENAI_API_KEY`,
// text-embedding-3-small), both asked for 1024 numbers. Without a key, search stays by words. The
// texts sent are the entries' words; nothing else leaves.

const TIMEOUT_MS = 30_000;

async function post(url: string, key: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `The embeddings service answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  return response.json();
}

export function voyageEmbedder(key: string, model = 'voyage-3.5-lite'): Embedder {
  return {
    model,
    async embed(texts, kind) {
      const answer = (await post('https://api.voyageai.com/v1/embeddings', key, {
        input: texts,
        model,
        input_type: kind,
        output_dimension: VECTOR_DIMENSIONS,
      })) as { data: { embedding: number[]; index: number }[] };
      return answer.data.sort((a, b) => a.index - b.index).map((one) => one.embedding);
    },
  };
}

export function openaiEmbedder(key: string, model = 'text-embedding-3-small'): Embedder {
  return {
    model,
    async embed(texts) {
      const answer = (await post('https://api.openai.com/v1/embeddings', key, {
        input: texts,
        model,
        dimensions: VECTOR_DIMENSIONS,
      })) as { data: { embedding: number[]; index: number }[] };
      return answer.data.sort((a, b) => a.index - b.index).map((one) => one.embedding);
    },
  };
}

/** The embedder this server has a key for, or null: search then stays by words. */
export function embedderFor(env: NodeJS.ProcessEnv = process.env): Embedder | null {
  if (env.VOYAGE_API_KEY) return voyageEmbedder(env.VOYAGE_API_KEY);
  if (env.OPENAI_API_KEY) return openaiEmbedder(env.OPENAI_API_KEY);
  return null;
}

/** How many entries a pass turns into vectors: one call to the model. */
export const EMBEDS_PER_PASS = 64;

/** The entries whose vector is missing or old, turned; how many turned, how many failed. */
export async function embedOnce(
  db: pg.Pool,
  embedder: Embedder,
): Promise<{ embedded: number; failed: number }> {
  const targets = await entriesToEmbed(db, embedder.model, EMBEDS_PER_PASS);
  // One reading and one writing per person, whatever the number of her entries.
  const byPerson = new Map<string, Map<string, string>>();
  for (const one of targets) {
    if (!byPerson.has(one.person)) byPerson.set(one.person, new Map());
    byPerson.get(one.person)!.set(one.entryId, one.spaceId);
  }
  const said: { entryId: string; spaceId: string; person: string; text: string; hash: string }[] =
    [];
  for (const [person, entries] of byPerson) {
    for (const one of await asPerson(db, person, (tx) => saidOfMany(tx, [...entries.keys()]))) {
      said.push({ ...one, person, spaceId: entries.get(one.entryId)! });
    }
  }
  if (said.length === 0) return { embedded: 0, failed: 0 };
  try {
    const vectors = await embedder.embed(
      said.map((one) => one.text),
      'document',
    );
    for (const person of byPerson.keys()) {
      await asPerson(db, person, async (tx) => {
        for (const [at, one] of said.entries()) {
          if (one.person !== person) continue;
          await keepVector(tx, {
            entryId: one.entryId,
            spaceId: one.spaceId,
            model: embedder.model,
            hash: one.hash,
            vector: vectors[at]!,
          });
        }
      });
    }
    return { embedded: said.length, failed: 0 };
  } catch (error) {
    console.warn('[watcher] meaning', (error as Error).message);
    return { embedded: 0, failed: said.length };
  }
}

/** Her space's entries nearest in meaning to a question; none without a model. */
export async function searchByMeaning(
  db: pg.Pool,
  embedder: Embedder | null,
  person: string,
  spaceId: string,
  text: string,
  options: { limit?: number; kind?: string } = {},
) {
  if (!embedder || !text.trim()) return [];
  const [vector] = await embedder.embed([text.trim()], 'query');
  return asPerson(db, person, (tx) => nearEntries(tx, spaceId, vector!, options));
}
