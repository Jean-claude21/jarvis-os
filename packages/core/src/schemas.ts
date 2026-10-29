import { z } from 'zod';

// The inputs of the core, shared by every door (REST API, MCP): what one accepts, the other does.

export const originSchema = z.enum(['said', 'read', 'inferred']);
export type Origin = z.infer<typeof originSchema>;

export const entryInputSchema = z.object({
  /** A name for a new entry within this save, so links can point to it. */
  ref: z.string().trim().min(1).max(40).optional(),
  /** An existing entry to change; absent for a new one. */
  id: z.string().trim().min(1).max(64).optional(),
  /** Free kind, in her words: « Dépense », « Passeport ». Required for a new entry. */
  kind: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  /** Fields to set; a field given `null` is removed. */
  data: z.record(z.string(), z.unknown()).optional(),
  /** Where the given fields come from: one origin for all, or one per field. Default « said ». */
  origin: z.union([originSchema, z.record(z.string(), originSchema)]).optional(),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const linkInputSchema = z.object({
  /** An entry id, or the `ref` of an entry of this save. */
  from: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1).max(64),
  /** In her words: « payé avec », « pièce de », « concerne ». */
  role: z.string().trim().min(1).max(80),
});
export type LinkInput = z.infer<typeof linkInputSchema>;

export const saveInputSchema = z.object({
  entries: z.array(entryInputSchema).max(50).default([]),
  links: z.array(linkInputSchema).max(100).default([]),
  unlink: z.array(linkInputSchema).max(100).default([]),
});
export type SaveInput = z.input<typeof saveInputSchema>;

export const findInputSchema = z.object({
  /** Words to find in titles and fields, accents and case aside; every word must be there. */
  text: z.string().trim().max(200).optional(),
  kind: z.string().trim().min(1).max(80).optional(),
  /** Created on or after this day (YYYY-MM-DD). */
  from: z.iso.date().optional(),
  /** Created on or before this day (YYYY-MM-DD). */
  to: z.iso.date().optional(),
  archived: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
});
export type FindInput = z.input<typeof findInputSchema>;

export const querySchema = z.object({
  /** One `select` over my_entries, my_links, my_files. */
  sql: z.string().trim().min(1).max(10_000),
});
