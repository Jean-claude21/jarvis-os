// What a journal line says, in her words (the v2 client's `said`), and who did it.

const COMMANDS: Record<string, string> = {
  'entry.create': 'a créé',
  'entry.update': 'a modifié',
  'entry.archive': 'a mis de côté',
  'link.add': 'a relié',
  'link.remove': 'a délié',
  'journal.undo': 'a annulé',
  'import.run': 'a importé',
  'migration.run': 'a migré',
  'app.install': 'a installé l’app',
  'app.remove': 'a retiré l’app',
  'entries.change': 'a rangé plusieurs entrées',
  'kind.rename': 'a renommé un type',
  'connector.add': 'a connecté',
  'connector.call': 'a appelé',
  'connector.change': 'a changé la connexion',
  'connector.cut': 'a coupé',
  'space.update': 'a réglé l’espace',
};
export const said = (command: string) => COMMANDS[command] ?? command;

/** Who acted: her, an assistant, Telegram, a rule, a source… with a readable name. */
export function whoOf(line: { actor: string; door: string; client: string | null }, me: string) {
  const client = line.client ?? '';
  if (client.startsWith('rule:'))
    return { name: `Règle « ${client.slice(5)} »`, kind: 'rule' as const };
  if (client.startsWith('script:'))
    return { name: `Script « ${client.slice(7)} »`, kind: 'rule' as const };
  if (client.startsWith('source:'))
    return { name: `Source « ${client.slice(7)} »`, kind: 'source' as const };
  if (client === 'health') return { name: 'Vérification', kind: 'rule' as const };
  if (client === 'lecture') return { name: 'Lecture de Jarvis', kind: 'rule' as const };
  if (client.startsWith('agent:')) return { name: client.slice(6), kind: 'agent' as const };
  if (line.door === 'telegram') return { name: 'Telegram', kind: 'door' as const };
  if (line.door === 'mcp' || /claude|chatgpt|codex|gemini/i.test(client))
    return {
      name: client ? client[0]!.toUpperCase() + client.slice(1) : 'Assistant',
      kind: 'ai' as const,
    };
  if (line.door === 'watcher') return { name: 'Jarvis', kind: 'rule' as const };
  return { name: line.actor === me ? 'Toi' : 'Un membre', kind: 'person' as const };
}

/** The door a change came through, in her words. */
const DOORS: Record<string, string> = {
  watcher: 'automatiquement',
  mcp: 'par un assistant',
  api: 'depuis le web',
  web: 'depuis le web',
  telegram: 'par Telegram',
  rule: 'par une règle',
  script: 'par un script',
  test: 'en essai',
};
export const doorOf = (door: string) => DOORS[door] ?? door;

/** The engine's own states, in her words; a state of her own model shows as she wrote it. */
const STATES: Record<string, string> = {
  todo: 'à faire',
  planned: 'prévu',
  done: 'fait',
  to_file: 'à ranger',
  proposed: 'proposé',
  accepted: 'accepté',
  declined: 'refusé',
  to_write: 'à rédiger',
  written: 'rédigé',
  to_fix: 'à corriger',
  failed: 'en échec',
  in_progress: 'en cours',
  cancelled: 'annulé',
};
export const stateOf = (status: string) => STATES[status] ?? status.replace(/_/g, ' ');

export const titleOf = (line: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) =>
  String(
    (line.after && (line.after.title ?? line.after.name ?? line.after.connector)) ??
      (line.before && (line.before.title ?? line.before.name)) ??
      '',
  );

/** What a document is, once Jarvis has read it (v3 V7): the core's genres in her words. */
export const GENRE_WORDS: Record<string, string> = {
  invoice: 'facture',
  quote: 'devis',
  notice: 'avis d’échéance',
  contract: 'contrat',
  prescription: 'ordonnance',
  statement: 'relevé',
  certificate: 'attestation',
  ticket: 'billet',
  payslip: 'bulletin de paie',
};
