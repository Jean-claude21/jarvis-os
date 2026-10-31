import { z } from 'zod';

// Her groups of kinds (spec 017): an entry of kind « Area » names the kinds it groups, so the
// Entries page shows them together — « Spirituel »: Prière, Réflexion, Culte.

export const AREA_KIND = 'Area';

export const areaDataSchema = z.object({
  /** The kinds she files under this group. */
  kinds: z.array(z.string().trim().min(1).max(80)).max(300),
  /** Where it comes among her groups. */
  order: z.number().int().min(0).max(1000).optional(),
});

/** An « Area »'s shape, checked; throws the sentence that says what to fix. */
export function checkArea(data: unknown) {
  const parsed = areaDataSchema.safeParse(data);
  if (!parsed.success)
    throw new Error(
      'An « Area » is { kinds: ["Prière", "Réflexion"], order? }: the kinds it groups.',
    );
  return parsed.data;
}
