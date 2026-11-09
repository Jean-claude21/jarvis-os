// « Discover » (spec 025): MCP servers their makers host, ready to connect in one click. Each says
// how it is signed in to; a server that changed its address says so at its first check
// (« unreachable »), and her own connector stays one click away. No vendor reaches the core.

export interface CatalogEntry {
  id: string;
  name: string;
  /** Empty when each person has her own address (she pastes it). */
  url: string;
  auth: 'none' | 'bearer' | 'oauth';
  category: 'notes' | 'work' | 'money' | 'design' | 'automation' | 'knowledge';
  fr: string;
  en: string;
  /** Where to make the key or find the address, when one is needed. */
  help?: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: 'notion',
    name: 'Notion',
    url: 'https://mcp.notion.com/mcp',
    auth: 'oauth',
    category: 'notes',
    fr: 'Pages, bases et notes de ton espace Notion : lire, chercher, écrire.',
    en: 'Pages, databases and notes of your Notion workspace: read, search, write.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    url: '',
    auth: 'none',
    category: 'automation',
    fr: 'Gmail, Google Agenda, Drive, Outlook et des milliers d’apps, par ton adresse MCP Zapier.',
    en: 'Gmail, Google Calendar, Drive, Outlook and thousands of apps, through your Zapier MCP address.',
    help: 'https://mcp.zapier.com',
  },
  {
    id: 'asana',
    name: 'Asana',
    url: 'https://mcp.asana.com/sse',
    auth: 'oauth',
    category: 'work',
    fr: 'Tâches, projets et échéances d’Asana.',
    en: 'Asana tasks, projects and deadlines.',
  },
  {
    id: 'linear',
    name: 'Linear',
    url: 'https://mcp.linear.app/mcp',
    auth: 'oauth',
    category: 'work',
    fr: 'Tickets, projets et cycles de Linear.',
    en: 'Linear issues, projects and cycles.',
  },
  {
    id: 'atlassian',
    name: 'Atlassian (Jira, Confluence)',
    url: 'https://mcp.atlassian.com/v1/sse',
    auth: 'oauth',
    category: 'work',
    fr: 'Tickets Jira et pages Confluence.',
    en: 'Jira issues and Confluence pages.',
  },
  {
    id: 'canva',
    name: 'Canva',
    url: 'https://mcp.canva.com/mcp',
    auth: 'oauth',
    category: 'design',
    fr: 'Tes designs Canva : chercher, créer, exporter.',
    en: 'Your Canva designs: search, create, export.',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    url: 'https://mcp.paypal.com/sse',
    auth: 'oauth',
    category: 'money',
    fr: 'Transactions, factures et paiements PayPal.',
    en: 'PayPal transactions, invoices and payments.',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://mcp.stripe.com',
    auth: 'bearer',
    category: 'money',
    fr: 'Clients, paiements et abonnements Stripe (avec une clé restreinte).',
    en: 'Stripe customers, payments and subscriptions (with a restricted key).',
    help: 'https://dashboard.stripe.com/apikeys',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://api.githubcopilot.com/mcp/',
    auth: 'bearer',
    category: 'work',
    fr: 'Dépôts, tickets et demandes de fusion GitHub (avec un jeton personnel).',
    en: 'GitHub repositories, issues and pull requests (with a personal token).',
    help: 'https://github.com/settings/personal-access-tokens',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    url: 'https://huggingface.co/mcp',
    auth: 'none',
    category: 'knowledge',
    fr: 'Modèles, jeux de données et articles de Hugging Face.',
    en: 'Hugging Face models, datasets and papers.',
  },
  {
    id: 'microsoft-learn',
    name: 'Microsoft Learn',
    url: 'https://learn.microsoft.com/api/mcp',
    auth: 'none',
    category: 'knowledge',
    fr: 'La documentation officielle de Microsoft (Office, Windows, Azure).',
    en: 'Microsoft’s official documentation (Office, Windows, Azure).',
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    url: 'https://mcp.deepwiki.com/mcp',
    auth: 'none',
    category: 'knowledge',
    fr: 'Comprendre n’importe quel projet open source, expliqué.',
    en: 'Any open-source project, explained.',
  },
];
