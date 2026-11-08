import type { Actor, Tx } from './db';
import { find, save } from './entries';
import { spacesOf } from './spaces';
import { DEFAULT_ZONE } from './time';

// Her time zone (spec 015): said once, kept in the « Channel » entry of her own space; every time
// she writes without a zone is read on that clock — her calendar, her reminders, « today » in a
// formula. Paris until she says otherwise.

/** Whether a name is a time zone the clock knows (« Africa/Abidjan »). */
export function isZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The zone of the person this transaction acts for. */
export async function zoneOf(tx: Tx): Promise<string> {
  const { rows } = await tx.query<{ zone: string | null }>(
    `select e.data->>'timezone' as zone
       from entry e join space s on s.id = e.space_id
      where s.personal and s.created_by = current_setting('jarvis.person', true)
        and e.archived_at is null and jarvis_fold(e.kind) = 'channel' and e.data ? 'timezone'
      order by e.created_at limit 1`,
  );
  const zone = rows[0]?.zone;
  return isZone(zone) ? zone : DEFAULT_ZONE;
}

/** Keeps her zone, in her own space's « Channel ». */
export async function setZone(tx: Tx, actor: Actor, zone: string): Promise<string> {
  if (!isZone(zone))
    throw new Error(`« ${zone} » is not a time zone (« Europe/Paris », « Africa/Abidjan »).`);
  const own = (await spacesOf(tx)).find((one) => one.personal);
  if (!own) throw new Error('No space of her own.');
  const [channel] = await find(tx, own.id, { kind: 'Channel', limit: 1 });
  await save(tx, actor, own.id, {
    entries: [
      channel
        ? { id: channel.id, data: { timezone: zone } }
        : { kind: 'Channel', title: 'Jarvis', data: { timezone: zone } },
    ],
  });
  return zone;
}
