# Parité avec un Life OS en Markdown — le protocole de test

> Ce que l'auteur fait aujourd'hui avec son Life OS (Claude Code sur un dossier Markdown), et comment
> le refaire avec Claude connecté à Jarvis OS. Chaque ligne se teste dans Claude.ai, connecteur
> Jarvis-Os branché sur `https://<domaine>/mcp`. Une ligne cochée = la parité est prouvée.

## Avant de commencer

1. `pnpm serve` tourne (API, veilleur, tunnel).
2. Dans Claude : Paramètres → Connecteurs → Jarvis-Os → Déconnecter, puis ajouter
   `https://<domaine>/mcp`, se connecter, cocher l'espace personnel au consentement.
3. Ouvrir une nouvelle conversation : les instructions (charte, routines, échéances) sont lues à
   la connexion.

## Le corpus

| ✓   | Dire à Claude                                      | Attendu                                                              |
| --- | -------------------------------------------------- | -------------------------------------------------------------------- |
| [ ] | « Qu'ai-je vécu le 1er septembre ? »               | le journal du jour, lu dans son `texte`, avec ses liens              |
| [ ] | « Qu'est-ce que Dieu m'a dit en septembre ? »      | une recherche sur les journaux et prières du mois, citée             |
| [ ] | « Où en est Vestio ? »                             | la carte de la culture et ce qui « fait partie de » elle             |
| [ ] | « Qui est Christian pour moi ? »                   | la fiche, la relation, la prochaine action                           |
| [ ] | « Montre-moi la résolution sur l'action de grâce » | la vue de lecture du document, son sommaire, un lien pour l'imprimer |
| [ ] | « Combien de journaux par mois cette année ? »     | un tableau de bord en barres, recalculé                              |

## La méthode (skills → routines, CLAUDE.md et SYSTEME.md → charte)

| ✓   | Dire à Claude                                    | Attendu                                                                    |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| [ ] | « /matin »                                       | la routine `matin` suivie : la réception d'abord, puis le suivi du jour    |
| [ ] | « #soir … » (un compte rendu libre)              | `diagnostic-du-soir` : un miroir bref, le journal du jour complété         |
| [ ] | « Fais mon bilan de la semaine »                 | `bilan-hebdo` écrit comme un document « Bilan », lisible et téléchargeable |
| [ ] | « Bilan mensuel »                                | `bilan-mensuel`, l'annexe financière calculée par `query`                  |
| [ ] | « J'ai un doute sur … »                          | `appliquer-posture` : la posture codifiée chargée et appliquée             |
| [ ] | « Montre mes révélations »                       | `historique` : par `find`/`query`, jamais un script à lancer               |
| [ ] | « Émonde le système »                            | `emondage` : kinds peu utilisés, cultures immobiles, doublons, proposés    |
| [ ] | « Range ceci : … »                               | `ranger-inbox` : enregistré en entrées liées, rien n'est inventé           |
| [ ] | Une règle de la charte (la dîme sort en premier) | appliquée sans être demandée lors d'une décision financière                |

## Les documents

| ✓   | Dire à Claude                                      | Attendu                                                              |
| --- | -------------------------------------------------- | -------------------------------------------------------------------- |
| [ ] | « Rédige une théorie sur … » (long)                | `write_document` puis `edit_document` par sections, selon mes cadres |
| [ ] | « Ajoute une section Application à cette théorie » | seule la section est envoyée ; une nouvelle version                  |
| [ ] | « Renvoie-moi la théorie pour la lire »            | la vue de lecture ; « Imprimer / PDF » et « Markdown » marchent      |
| [ ] | « Reviens à la version d'avant »                   | le texte d'avant revient (bouton dans la vue, ou `undo`)             |

## Le temps (cadence.md → rappels qui reviennent, sur Telegram)

| ✓   | Dire à Claude                                                        | Attendu                                          |
| --- | -------------------------------------------------------------------- | ------------------------------------------------ |
| [ ] | « Rappelle-moi dans 3 minutes de boire de l'eau »                    | un message Telegram à l'heure                    |
| [ ] | « Chaque soir à 20h45 sauf le samedi, appelle-moi au dépôt du jour » | `repete` « 45 20 \* \* 0-5 », prochaine annoncée |
| [ ] | « Le lundi à 7h15, la pensée de la semaine »                         | `repete` « 15 7 \* \* 1 »                        |
| [ ] | « Le dernier jour du mois à 19h30, le bilan mensuel »                | `repete` « 30 19 L \* \* »                       |
| [ ] | « Le samedi à 20h30, le bilan du samedi »                            | `repete` « 30 20 \* \* 6 »                       |
| [ ] | « Mes échéances à 7h30 chaque jour »                                 | `repete` « 30 7 \* \* \* »                       |
| [ ] | Ouvrir une conversation la veille d'une échéance                     | Claude la cite (l'anticipation)                  |

## Pas encore repris (après le test)

- La capture par Telegram (`#inbox`, `#soir`, `/capture`) : aujourd'hui, Telegram reçoit les rappels ;
  on écrit à Claude.
- `mettre-en-voix` : un outil de synthèse vocale côté serveur.
- `preparer-presentation` : Claude produit le support ; Jarvis garde le résultat (`upload_link`).
- La nuit préparatoire (transcription du miroir Syncthing).
- L'export chaque nuit vers le dépôt git : Jarvis devient la source, le dépôt une sauvegarde.
- Toujours en ligne : hébergement (Coolify) et domaine — sans PC allumé, rien ne part.
