// The components (v3 D21): one registry for every piece of the interface — the formats of a page,
// the blocks a page computes, the views, the inputs, what says who and what. Pages, apps, Claude
// and the catalogue all call a component by its name; a component never exists for one app.
// Adding one = its entry here (+ its render in the client, + its computation if it reads data).

export type ComponentCategory =
  'format' | 'navigation' | 'input' | 'figure' | 'list' | 'identity' | 'content' | 'feedback';

export const COMPONENT_CATEGORIES: { id: ComponentCategory; fr: string; en: string }[] = [
  { id: 'format', fr: 'Formats de page', en: 'Page formats' },
  { id: 'figure', fr: 'Chiffres et graphiques', en: 'Figures and charts' },
  { id: 'list', fr: 'Listes et vues', en: 'Lists and views' },
  { id: 'input', fr: 'Saisie', en: 'Input' },
  { id: 'navigation', fr: 'Navigation', en: 'Navigation' },
  { id: 'identity', fr: 'Identité', en: 'Identity' },
  { id: 'content', fr: 'Contenu', en: 'Content' },
  { id: 'feedback', fr: 'Retours', en: 'Feedback' },
];

export interface ComponentInfo {
  /** Its one name in the code. */
  id: string;
  /** The other names it answers to — in her words, in any language. */
  aliases: string[];
  category: ComponentCategory;
  label: { fr: string; en: string };
  /** When to use it (and when not), in one or two sentences. */
  when: string;
  /** What it reads: the facets a kind must have, or the fields it names. */
  needs?: { facets?: string[]; fields?: string[] };
  /** A page block, computed by the core (`blockSchema`): usable in a « Page ». */
  block?: boolean;
  /** Its settings, as Claude writes them in a page (an example, valid). */
  example?: Record<string, unknown>;
}

export const COMPONENTS: ComponentInfo[] = [
  // Formats of a page.
  {
    id: 'list_detail',
    aliases: ['liste et détail', 'liste + détail', 'master detail', 'split', 'maître détail'],
    category: 'format',
    label: { fr: 'Liste + détail', en: 'List and detail' },
    when: 'Parcourir des entrées et lire chacune sans quitter la liste : personnes, documents, offres. La liste à gauche, la fiche à droite ; sur téléphone, la fiche par-dessus.',
  },
  {
    id: 'app_shell',
    aliases: ['modèle d’app', 'app à menu', 'menu à gauche', 'app shell'],
    category: 'format',
    label: { fr: 'Modèle d’app', en: 'App shell' },
    when: 'Toute app : son menu à gauche (Aperçu, ses pages, ses données, son activité), le contenu à droite. Une app plus riche ajoute des pages, jamais une mise en page.',
  },
  {
    id: 'overview',
    aliases: ['aperçu', 'overview'],
    category: 'format',
    label: { fr: 'Aperçu', en: 'Overview' },
    when: 'La première page d’une app : générée depuis les facettes de ses types (chiffres, étapes, échéances, objectifs, fichiers, activité).',
  },
  {
    id: 'dashboard',
    aliases: ['tableau de bord', 'dashboard', 'page'],
    category: 'format',
    label: { fr: 'Tableau de bord', en: 'Dashboard' },
    when: 'Une page de chiffres et de blocs : une rangée de chiffres, une grille de blocs, ses filtres en haut. Toute « Page » d’une app s’affiche ainsi.',
  },
  {
    id: 'record_page',
    aliases: ['fiche', 'record', 'entrée'],
    category: 'format',
    label: { fr: 'Fiche', en: 'Record' },
    when: 'Une entrée : dessinée depuis ses facettes (qui, document), ses valeurs, ses liens, ses fichiers, son histoire.',
  },
  // Figures and charts (page blocks).
  {
    id: 'stat',
    aliases: ['chiffre', 'chiffre clé', 'kpi', 'stat', 'nombre'],
    category: 'figure',
    label: { fr: 'Chiffre clé', en: 'Key figure' },
    when: 'Un seul nombre qui compte (combien, quel total). Quatre au plus côte à côte.',
    block: true,
    example: { block: 'stat', title: 'Offres', query: { kind: 'JobOffer', aggregate: { n: 'count()' } } },
  },
  {
    id: 'stat_delta',
    aliases: ['évolution', 'chiffre et évolution', 'delta', 'tendance'],
    category: 'figure',
    label: { fr: 'Chiffre et évolution', en: 'Figure and change' },
    when: 'Un nombre du mois et son écart avec le mois d’avant (la requête utilise {month}).',
    block: true,
  },
  {
    id: 'gauge',
    aliases: ['jauge', 'progression', 'anneau', 'ring', 'barre de progression'],
    category: 'figure',
    label: { fr: 'Jauge', en: 'Gauge' },
    when: 'Où en est chaque entrée par rapport à un maximum : un budget, un objectif, une régularité.',
    needs: { facets: ['measurable'] },
    block: true,
    example: { block: 'gauge', title: 'Objectifs', kind: 'Goal', value: 'measure', max: 'target' },
  },
  {
    id: 'bar',
    aliases: ['barres', 'histogramme', 'bar chart'],
    category: 'figure',
    label: { fr: 'Barres', en: 'Bars' },
    when: 'Comparer des groupes entre eux (par compte, par catégorie).',
    block: true,
  },
  {
    id: 'line',
    aliases: ['courbe', 'ligne', 'line chart', 'évolution dans le temps'],
    category: 'figure',
    label: { fr: 'Courbe', en: 'Line' },
    when: 'Une valeur au fil du temps (mois par mois, jour par jour).',
    needs: { facets: ['dated'] },
    block: true,
  },
  {
    id: 'breakdown',
    aliases: ['répartition', 'camembert', 'parts', 'donut'],
    category: 'figure',
    label: { fr: 'Répartition', en: 'Breakdown' },
    when: 'La part de chaque valeur dans un tout (humeurs, catégories de dépenses).',
    block: true,
  },
  {
    id: 'funnel',
    aliases: ['entonnoir', 'funnel', 'par étape'],
    category: 'figure',
    label: { fr: 'Entonnoir', en: 'Funnel' },
    when: 'Combien en sont à chaque étape d’un parcours (offres, candidatures, projets).',
    needs: { facets: ['stages'] },
    block: true,
  },
  {
    id: 'heatmap',
    aliases: ['carte de chaleur', 'heatmap', 'calendrier de régularité', 'jours pointés'],
    category: 'figure',
    label: { fr: 'Carte de chaleur', en: 'Heatmap' },
    when: 'Les jours où quelque chose a été fait, sur des semaines : la régularité d’une habitude.',
    needs: { facets: ['dated'] },
    block: true,
  },
  // Lists and views.
  {
    id: 'table',
    aliases: ['tableau', 'table'],
    category: 'list',
    label: { fr: 'Tableau', en: 'Table' },
    when: 'Des entrées en colonnes, avec un total si une colonne s’additionne.',
    block: true,
  },
  {
    id: 'datatable',
    aliases: ['tableau de données', 'datatable', 'grille'],
    category: 'list',
    label: { fr: 'Tableau de données', en: 'Data table' },
    when: 'Un tableau qu’on cherche, filtre et trie dans la page, avec des gestes sur chaque ligne (« Postulée », « Écarter »).',
    block: true,
  },
  {
    id: 'task_list',
    aliases: ['liste à cocher', 'à faire', 'checklist', 'task list'],
    category: 'list',
    label: { fr: 'Liste à cocher', en: 'Task list' },
    when: 'Des entrées à traiter, chacune cochée d’un geste qui change un champ (« Payée »).',
    block: true,
  },
  {
    id: 'review',
    aliases: ['revue', 'trier', 'décider', 'review'],
    category: 'list',
    label: { fr: 'Revue', en: 'Review' },
    when: 'Passer des entrées une à une pour décider : la liste, la fiche de celle choisie, ses gestes.',
    block: true,
  },
  {
    id: 'kanban',
    aliases: ['kanban', 'colonnes', 'tableau kanban'],
    category: 'list',
    label: { fr: 'Kanban', en: 'Kanban' },
    when: 'Des entrées en colonnes selon leur étape ; on les fait glisser.',
    needs: { facets: ['stages'] },
    block: true,
  },
  {
    id: 'calendar',
    aliases: ['calendrier', 'agenda', 'semaine'],
    category: 'list',
    label: { fr: 'Calendrier', en: 'Calendar' },
    when: 'Les jours à venir de son agenda, toutes apps confondues.',
    needs: { facets: ['dated'] },
    block: true,
  },
  {
    id: 'view',
    aliases: ['vue', 'view'],
    category: 'list',
    label: { fr: 'Vue', en: 'View' },
    when: 'Une vue enregistrée d’un type, posée dans la page.',
    block: true,
  },
  {
    id: 'cards',
    aliases: ['cartes', 'galerie', 'gallery'],
    category: 'list',
    label: { fr: 'Cartes', en: 'Cards' },
    when: 'Des entrées à reconnaître d’un coup d’œil : une personne, un objet, une offre.',
  },
  {
    id: 'timeline',
    aliases: ['frise', 'timeline', 'gantt'],
    category: 'list',
    label: { fr: 'Frise', en: 'Timeline' },
    when: 'Des entrées qui durent, sur des semaines ou des mois, avec ce qui vient avant.',
    needs: { facets: ['dated'] },
  },
  {
    id: 'files',
    aliases: ['fichiers', 'documents', 'files'],
    category: 'list',
    label: { fr: 'Fichiers', en: 'Files' },
    when: 'Des fichiers à chercher, trier, déposer.',
    needs: { facets: ['document'] },
  },
  // Input.
  {
    id: 'form',
    aliases: ['formulaire', 'ajouter', 'form'],
    category: 'input',
    label: { fr: 'Formulaire', en: 'Form' },
    when: 'Ajouter une entrée d’un type, depuis son modèle.',
    block: true,
  },
  {
    id: 'select',
    aliases: ['sélection', 'liste déroulante', 'select'],
    category: 'input',
    label: { fr: 'Sélection', en: 'Select' },
    when: 'Choisir une valeur parmi plusieurs (plus de quatre ; sinon des boutons segmentés).',
  },
  {
    id: 'segmented',
    aliases: ['boutons segmentés', 'bascule', 'segmented'],
    category: 'input',
    label: { fr: 'Boutons segmentés', en: 'Segmented' },
    when: 'Choisir parmi deux à quatre valeurs visibles d’un coup (une période, un mode).',
  },
  {
    id: 'date',
    aliases: ['date', 'choix de date', 'date picker'],
    category: 'input',
    label: { fr: 'Choix de date', en: 'Date' },
    when: 'Une date (ou une date et une heure).',
  },
  {
    id: 'dropzone',
    aliases: ['zone de dépôt', 'déposer', 'upload'],
    category: 'input',
    label: { fr: 'Zone de dépôt', en: 'Drop zone' },
    when: 'Déposer des fichiers ; partout ailleurs, la page entière accepte déjà un dépôt.',
  },
  // Navigation.
  {
    id: 'tabs',
    aliases: ['onglets', 'tabs'],
    category: 'navigation',
    label: { fr: 'Onglets', en: 'Tabs' },
    when: 'Quelques facettes d’une même chose (Compte, Espaces, Connexions).',
  },
  {
    id: 'menu',
    aliases: ['menu', 'menu ⋯', 'actions'],
    category: 'navigation',
    label: { fr: 'Menu ⋯', en: 'Menu' },
    when: 'Les gestes secondaires d’une entrée ou d’une page.',
  },
  // Identity.
  {
    id: 'avatar',
    aliases: ['avatar', 'personne', 'logo', 'identité'],
    category: 'identity',
    label: { fr: 'Avatar et logo', en: 'Avatar and logo' },
    when: 'Qui : une personne (initiales, le logo de là où elle travaille), une organisation (son vrai logo).',
    needs: { facets: ['who'] },
  },
  {
    id: 'tag',
    aliases: ['étiquette', 'pastille', 'badge', 'tag'],
    category: 'identity',
    label: { fr: 'Étiquette', en: 'Tag' },
    when: 'Un état ou une nature en un mot (« proposé », « en retard »), sa couleur dit son ton.',
  },
  {
    id: 'file_icon',
    aliases: ['icône de fichier', 'file icon'],
    category: 'identity',
    label: { fr: 'Icône de fichier', en: 'File icon' },
    when: 'Le genre d’un fichier d’un coup d’œil (PDF, image, tableur…).',
  },
  // Content.
  {
    id: 'markdown',
    aliases: ['markdown', 'texte', 'note', 'document'],
    category: 'content',
    label: { fr: 'Markdown', en: 'Markdown' },
    when: 'Un texte écrit en Markdown, lu comme une page (titres, tableaux, cases, liens).',
  },
  {
    id: 'journal',
    aliases: ['journal', 'activité', 'historique'],
    category: 'content',
    label: { fr: 'Journal', en: 'Activity' },
    when: 'Qui a fait quoi, quand, avec Annuler.',
  },
  {
    id: 'record',
    aliases: ['fiche dans une page', 'record'],
    category: 'content',
    label: { fr: 'Fiche dans une page', en: 'Record block' },
    when: 'Une entrée avec ses champs, ses formules et ses relations, dans une page (sa page de détail).',
    block: true,
  },
  {
    id: 'sql',
    aliases: ['requête', 'sql'],
    category: 'content',
    label: { fr: 'Requête SQL', en: 'SQL' },
    when: 'L’échappatoire : un select sur ses copies, en chiffre, barres, courbe ou tableau.',
    block: true,
  },
  {
    id: 'live',
    aliases: ['bloc vivant', 'live', 'composant sur mesure'],
    category: 'content',
    label: { fr: 'Bloc vivant', en: 'Live block' },
    when: 'Un composant écrit pour un besoin, isolé, avec les seules données qu’il déclare. En dernier recours.',
    block: true,
  },
  // Feedback.
  {
    id: 'toast',
    aliases: ['message bref', 'toast', 'notification'],
    category: 'feedback',
    label: { fr: 'Message bref', en: 'Toast' },
    when: 'Dire en une phrase ce qui vient de se passer, sans bloquer.',
  },
  {
    id: 'confirm',
    aliases: ['confirmation', 'modale', 'dialog', 'confirm'],
    category: 'feedback',
    label: { fr: 'Confirmation', en: 'Confirm' },
    when: 'Avant un geste qu’on ne défait pas d’un clic (retirer quelqu’un, couper une connexion).',
  },
  {
    id: 'empty',
    aliases: ['vide', 'empty'],
    category: 'feedback',
    label: { fr: 'Vide', en: 'Empty' },
    when: 'Quand il n’y a rien : dire pourquoi et quoi faire.',
  },
];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9+⋯ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A component by any of its names, or null. */
export function componentNamed(name: string): ComponentInfo | null {
  const wanted = fold(name);
  return (
    COMPONENTS.find(
      (one) =>
        fold(one.id) === wanted ||
        one.aliases.some((alias) => fold(alias) === wanted) ||
        fold(one.label.fr) === wanted ||
        fold(one.label.en) === wanted,
    ) ?? null
  );
}

/** The page block a name stands for (« jauge » → « gauge »), else the name as given. */
export function blockNamed(name: string): string {
  const one = componentNamed(name);
  return one?.block ? one.id : name;
}
