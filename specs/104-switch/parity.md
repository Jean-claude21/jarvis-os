# 104 — V9: parity of the v3 with the v2, before the switch

_Audit of 20 Nov 2026, on `next` (`31eba3c`)._

**Method.** Every page of the v2 client (`apps/api/src/platform/client`, 27 page names) and every
API route it calls (39) or writes to (27 gestures) was compared with the v3 client (`apps/web`,
70 routes). A gesture is covered when the v3 does the same thing, by the same route or another.
Items marked « par l'assistant » have an MCP door but no screen.

Legend: ✅ covered · ↪ replaced on purpose (the v3 decision is cited) · ❌ missing.

## Pages

| v2 page                                                                                        | v3                                   | State                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------- |
| Maintenant (`#/`)                                                                              | Aujourd'hui                          | ✅                                |
| Agenda, Rappels                                                                                | Agenda (calendar engine)             | ✅                                |
| Tâches, Activités                                                                              | Tâches                               | ✅                                |
| Ranger                                                                                         | À valider                            | ✅ (F5)                           |
| Vie, Entrée                                                                                    | Apps' data, the fiche, the side card | ✅                                |
| Documents, Document, Fichiers                                                                  | Documents                            | ✅                                |
| Tableaux                                                                                       | An app's pages, Composer             | ✅ (F4)                           |
| Personnes                                                                                      | Personnes                            | ✅                                |
| Apps, App                                                                                      | Mes apps, an app's menu              | ✅                                |
| Bilans                                                                                         | Bilans                               | ✅ (F4)                           |
| Skills                                                                                         | Construire › Skills                  | ✅ (F6b)                          |
| Journal                                                                                        | Activité                             | ✅                                |
| Espaces, Espace, Compte, Connexions                                                            | Réglages                             | ✅ (with the gaps below)          |
| Revue (`#/revue`: a guided review with answers and decisions)                                  | Bilans, written by her skill         | ↪ spec 099: a bilan is a document |
| Collections, Modèles (her kinds listed)                                                        | Construire, apps' data               | ↪ partly; see « types » below     |
| Rôle d'une app (what it covers, the words that call it, what it reads and writes, its bridges) | An app's Aperçu, « Son rôle »        | ✅                                |
| Données (export, import, her kinds, what Jarvis sent, backups)                                 | Réglages › Compte                    | ✅                                |
| Bienvenue (first time: 4 steps)                                                                | Aujourd'hui, « Pour commencer »      | ✅                                |

## Gestures missing in the v3 — closed (20 Nov 2026)

Each closed with its end-to-end test (`apps/e2e`), at three widths.

### Blocking the switch

- [x] **Noter d'un geste**: « Noter « … » » in the bar (Ctrl K, the sidebar, the phone's top bar).
- [x] **L'heure du brief**: Réglages › Compte, « Le lire maintenant », « Me l'envoyer maintenant »;
      by e-mail when Telegram is not linked.
- [x] **Quels espaces un assistant atteint**: « Ses espaces » in Réglages › Assistants.

### Before opening sign-ups

- [x] **Bienvenue**: « Pour commencer » on Aujourd'hui, four steps ticked when done.

### The others

- [x] Ce que Jarvis t'a envoyé: Réglages › Compte.
- [x] Sauvegardes: Réglages › Compte, each to download.
- [x] Importer un dossier de notes (Markdown): Réglages › Compte. A spreadsheet: dropped as a
      file, read on its page (CSV as a table); no import into entries yet.
- [x] Adresse de l'agenda: Agenda › « Dans mon téléphone ».
- [x] Un serveur d'outils (MCP): Réglages › Connexions, from the catalogue or by its address.
- [x] Renommer un type: in place on its data (« Renommer »), and its fields (« Ses champs »).
      ↪ Groups of kinds: replaced by apps (the v3 files kinds in apps, spec 099).
- ↪ Ranger une app dans un domaine: replaced; the v3 has no domains, its menu is her apps.
- [x] Actions sur plusieurs entrées: the table ticks rows (set aside, file in a folder).
- [x] Créer un partage: « Partager par un lien » on a kind (a form or a list).
- [x] Tout fusionner: in À valider.
- [x] Structurer un skill: « Structurer » in Construire › Skills.
- [x] Question chiffrée: answered in the bar.
- [x] Tableau des habitudes: Objectifs, 28 days.

## After the gaps: the switch itself

- [x] Each blocking gap above closed (on next from `81035bb`).
- [ ] Her data on next checked: migrations 0034–0037, « Lire les offres » under the Chasseur
      d'offres, the bilan skills' triggers (with her yes), Candidatures release 2.
- [ ] Backup of production, then the migrations of V1–F7 and F6b applied to main.
- [ ] `apps/web` served at `/app`; `/v3` sends there.
- [ ] The v2 client (`apps/api/src/platform/client`, about 7 700 lines) and the modules the v3
      merged are deleted in the same change (D20, R4).
- [ ] `docs/product/vision.md` and `docs/ARCHITECTURE.md` say the v3.
- [ ] J-C's green light.
