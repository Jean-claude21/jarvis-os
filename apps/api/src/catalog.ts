import * as icons from 'simple-icons';

// « Discover » (spec 025): MCP servers their makers host, ready to connect, the everyday ones first.
// Each says how it is signed in to; Google's ask a client registered once by whoever runs Jarvis
// (`JARVIS_GOOGLE_CLIENT_ID`, `JARVIS_GOOGLE_CLIENT_SECRET`). Every address answered when this list
// was written; one that moves says so at its first check (« unreachable »). Logos come from the
// simple-icons package, inside the page: nothing is fetched from elsewhere.

export type CatalogGroup = 'everyday' | 'files' | 'work' | 'money' | 'design';

export interface CatalogEntry {
  id: string;
  name: string;
  /** Empty when each person has her own address (she pastes it). */
  url: string;
  auth: 'none' | 'bearer' | 'oauth';
  group: CatalogGroup;
  fr: string;
  en: string;
  /** The simple-icons name of its logo; else its initial on its colour. */
  icon?: string;
  color?: string;
  /** A client registered once for Jarvis (the server does not register clients by itself). */
  client?: 'google';
  /** What Jarvis asks to reach, when the server asks for a scope. */
  scope?: string;
  /** Where to make the key or find the address. */
  help?: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    url: 'https://drivemcp.googleapis.com/mcp/v1',
    auth: 'oauth',
    group: 'everyday',
    icon: 'siGoogledrive',
    client: 'google',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    fr: 'Tes fichiers et dossiers Drive : chercher, lire, retrouver un document.',
    en: 'Your Drive files and folders: search, read, find a document.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://gmailmcp.googleapis.com/mcp/v1',
    auth: 'oauth',
    group: 'everyday',
    icon: 'siGmail',
    client: 'google',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    fr: 'Tes e-mails : chercher, lire, retrouver une facture ou un rendez-vous.',
    en: 'Your e-mail: search, read, find an invoice or an appointment.',
  },
  {
    id: 'google-calendar',
    name: 'Google Agenda',
    url: 'https://calendarmcp.googleapis.com/mcp/v1',
    auth: 'oauth',
    group: 'everyday',
    icon: 'siGooglecalendar',
    client: 'google',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    fr: 'Tes rendez-vous : voir tes journées, trouver un créneau, ajouter un événement.',
    en: 'Your appointments: see your days, find a free slot, add an event.',
  },
  {
    id: 'notion',
    name: 'Notion',
    url: 'https://mcp.notion.com/mcp',
    auth: 'oauth',
    group: 'everyday',
    icon: 'siNotion',
    fr: 'Tes pages, bases et notes Notion : lire, chercher, écrire.',
    en: 'Your Notion pages, databases and notes: read, search, write.',
  },
  {
    id: 'todoist',
    name: 'Todoist',
    url: 'https://ai.todoist.net/mcp',
    auth: 'oauth',
    group: 'everyday',
    icon: 'siTodoist',
    fr: 'Tes tâches et projets Todoist.',
    en: 'Your Todoist tasks and projects.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    url: '',
    auth: 'none',
    group: 'everyday',
    icon: 'siZapier',
    fr: 'Outlook, OneDrive, WhatsApp et des milliers d’apps, par ton adresse MCP Zapier.',
    en: 'Outlook, OneDrive, WhatsApp and thousands of apps, through your Zapier MCP address.',
    help: 'https://mcp.zapier.com',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    url: 'https://mcp.dropbox.com/mcp',
    auth: 'oauth',
    group: 'files',
    icon: 'siDropbox',
    fr: 'Tes fichiers Dropbox : chercher, lire, partager.',
    en: 'Your Dropbox files: search, read, share.',
  },
  {
    id: 'box',
    name: 'Box',
    url: 'https://mcp.box.com',
    auth: 'oauth',
    group: 'files',
    icon: 'siBox',
    fr: 'Tes documents Box.',
    en: 'Your Box documents.',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    url: 'https://mcp.airtable.com/mcp',
    auth: 'oauth',
    group: 'files',
    icon: 'siAirtable',
    fr: 'Tes bases Airtable : lire et mettre à jour des lignes.',
    en: 'Your Airtable bases: read and update records.',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    url: 'https://mcp.paypal.com/sse',
    auth: 'oauth',
    group: 'money',
    icon: 'siPaypal',
    fr: 'Tes transactions, factures et paiements PayPal.',
    en: 'Your PayPal transactions, invoices and payments.',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://mcp.stripe.com',
    auth: 'bearer',
    group: 'money',
    icon: 'siStripe',
    fr: 'Clients, paiements et abonnements Stripe, avec une clé restreinte.',
    en: 'Stripe customers, payments and subscriptions, with a restricted key.',
    help: 'https://dashboard.stripe.com/apikeys',
  },
  {
    id: 'square',
    name: 'Square',
    url: 'https://mcp.squareup.com/sse',
    auth: 'oauth',
    group: 'money',
    icon: 'siSquare',
    fr: 'Ventes, clients et paiements Square.',
    en: 'Square sales, customers and payments.',
  },
  {
    id: 'asana',
    name: 'Asana',
    url: 'https://mcp.asana.com/sse',
    auth: 'oauth',
    group: 'work',
    icon: 'siAsana',
    fr: 'Tâches, projets et échéances Asana.',
    en: 'Asana tasks, projects and deadlines.',
  },
  {
    id: 'monday',
    name: 'monday.com',
    url: 'https://mcp.monday.com/mcp',
    auth: 'oauth',
    group: 'work',
    color: 'FF3D57',
    fr: 'Tableaux, éléments et échéances monday.com.',
    en: 'monday.com boards, items and deadlines.',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    url: 'https://mcp.clickup.com/mcp',
    auth: 'oauth',
    group: 'work',
    icon: 'siClickup',
    fr: 'Tâches, listes et documents ClickUp.',
    en: 'ClickUp tasks, lists and docs.',
  },
  {
    id: 'atlassian',
    name: 'Jira et Confluence',
    url: 'https://mcp.atlassian.com/v1/sse',
    auth: 'oauth',
    group: 'work',
    icon: 'siAtlassian',
    fr: 'Tickets Jira et pages Confluence.',
    en: 'Jira issues and Confluence pages.',
  },
  {
    id: 'linear',
    name: 'Linear',
    url: 'https://mcp.linear.app/mcp',
    auth: 'oauth',
    group: 'work',
    icon: 'siLinear',
    fr: 'Tickets, projets et cycles Linear.',
    en: 'Linear issues, projects and cycles.',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://api.githubcopilot.com/mcp/',
    auth: 'bearer',
    group: 'work',
    icon: 'siGithub',
    fr: 'Dépôts, tickets et demandes de fusion, avec un jeton personnel.',
    en: 'Repositories, issues and pull requests, with a personal token.',
    help: 'https://github.com/settings/personal-access-tokens',
  },
  {
    id: 'canva',
    name: 'Canva',
    url: 'https://mcp.canva.com/mcp',
    auth: 'oauth',
    group: 'design',
    color: '00C4CC',
    fr: 'Tes designs Canva : chercher, créer, exporter.',
    en: 'Your Canva designs: search, create, export.',
  },
  {
    id: 'figma',
    name: 'Figma',
    url: 'https://mcp.figma.com/mcp',
    auth: 'oauth',
    group: 'design',
    icon: 'siFigma',
    fr: 'Tes fichiers Figma : lire les maquettes et leurs composants.',
    en: 'Your Figma files: read designs and their components.',
  },
  {
    id: 'miro',
    name: 'Miro',
    url: 'https://mcp.miro.com',
    auth: 'oauth',
    group: 'design',
    icon: 'siMiro',
    fr: 'Tes tableaux Miro.',
    en: 'Your Miro boards.',
  },
];

/** A logo to draw: the brand's path and colour, and a readable colour on it. */
export interface Logo {
  path: string | null;
  hex: string;
  fg: string;
  initial: string;
}

const readableOn = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1a1a1a' : '#ffffff';
};

export function logoOf(entry: Pick<CatalogEntry, 'icon' | 'color' | 'name'>): Logo {
  const found = entry.icon
    ? (icons as unknown as Record<string, { path: string; hex: string } | undefined>)[entry.icon]
    : undefined;
  const hex = found?.hex ?? entry.color ?? '6B4E43';
  return { path: found?.path ?? null, hex, fg: readableOn(hex), initial: entry.name.slice(0, 1) };
}

/** The catalog as the page draws it: logos, and whether each can be connected here. */
export function catalogFor(env: NodeJS.ProcessEnv = process.env) {
  const google = Boolean(env.JARVIS_GOOGLE_CLIENT_ID && env.JARVIS_GOOGLE_CLIENT_SECRET);
  return CATALOG.map((entry) => ({
    ...entry,
    logo: logoOf(entry),
    ready: entry.client === 'google' ? google : true,
  }));
}

/** The client registered once for a server that does not register clients itself. */
export function presetClientFor(url: string, env: NodeJS.ProcessEnv = process.env) {
  const entry = CATALOG.find((one) => one.url === url);
  if (entry?.client !== 'google') return null;
  const id = env.JARVIS_GOOGLE_CLIENT_ID;
  const secret = env.JARVIS_GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      `« ${entry.name} » needs Jarvis's Google client: whoever runs Jarvis sets JARVIS_GOOGLE_CLIENT_ID and JARVIS_GOOGLE_CLIENT_SECRET.`,
    );
  }
  return { client: { client_id: id, client_secret: secret }, scope: entry.scope, google: true };
}
