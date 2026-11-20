# 104 — V9: parity of the v3 with the v2, before the switch

_Audit of 20 Nov 2026, on `next` (`31eba3c`)._

**Method.** Every page of the v2 client (`apps/api/src/platform/client`, 27 page names) and every
API route it calls (39) or writes to (27 gestures) was compared with the v3 client (`apps/web`,
70 routes). A gesture is covered when the v3 does the same thing, by the same route or another.
Items marked « par l'assistant » have an MCP door but no screen.

Legend: ✅ covered · ↪ replaced on purpose (the v3 decision is cited) · ❌ missing.

## Pages

| v2 page                                                                                        | v3                                   | State                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| Maintenant (`#/`)                                                                              | Aujourd'hui                          | ✅                                             |
| Agenda, Rappels                                                                                | Agenda (calendar engine)             | ✅                                             |
| Tâches, Activités                                                                              | Tâches                               | ✅                                             |
| Ranger                                                                                         | À valider                            | ✅ (F5)                                        |
| Vie, Entrée                                                                                    | Apps' data, the fiche, the side card | ✅                                             |
| Documents, Document, Fichiers                                                                  | Documents                            | ✅                                             |
| Tableaux                                                                                       | An app's pages, Composer             | ✅ (F4)                                        |
| Personnes                                                                                      | Personnes                            | ✅                                             |
| Apps, App                                                                                      | Mes apps, an app's menu              | ✅                                             |
| Bilans                                                                                         | Bilans                               | ✅ (F4)                                        |
| Skills                                                                                         | Construire › Skills                  | ✅ (F6b)                                       |
| Journal                                                                                        | Activité                             | ✅                                             |
| Espaces, Espace, Compte, Connexions                                                            | Réglages                             | ✅ (with the gaps below)                       |
| Revue (`#/revue`: a guided review with answers and decisions)                                  | Bilans, written by her skill         | ↪ spec 099: a bilan is a document              |
| Collections, Modèles (her kinds listed)                                                        | Construire, apps' data               | ↪ partly; see « types » below                  |
| Rôle d'une app (what it covers, the words that call it, what it reads and writes, its bridges) | An app's Aperçu                      | ❌ no screen says an app's role                |
| Données (export, import, her kinds, what Jarvis sent, backups)                                 | Réglages › Compte: export only       | ❌ see below                                   |
| Bienvenue (first time: 4 steps)                                                                | —                                    | ❌ a new account lands on an empty Aujourd'hui |

## Gestures missing in the v3

### Blocking the switch (she uses them every day, or the v3 points to them)

- [ ] **Noter d'un geste.** The sidebar says « Chercher ou noter », but the palette only searches.
      The v2 kept a capture from anywhere (`POST /inbox`).
- [ ] **L'heure du brief.** The Assistant du matin says « quand tu choisis une heure dans
      Réglages », but no setting in Réglages sets it (v2: `/me/prefs`). Also missing: reading the
      brief now, and sending it now (`/me/brief`).
- [ ] **Quels espaces un assistant atteint.** Réglages › Assistants revokes an access, but cannot
      choose the spaces a client reaches (v2: `PUT /clients/:id/spaces`).

### Before opening sign-ups (not for her own switch)

- [ ] **Bienvenue**: the first steps of a new account (import notes, a spreadsheet, start from
      zero).

### Not blocking: an assistant does it, or it is rarely used

- [ ] Ce que Jarvis t'a envoyé (7 days, by channel, failures): `/outbox`. Visible nowhere in the v3.
- [ ] Sauvegardes: the last backup of each space. Visible nowhere in the v3.
- [ ] Importer un dossier de notes (Markdown) or a spreadsheet: `/import`. Par l'assistant: no.
- [ ] Adresse de l'agenda (ICS) to subscribe from a phone: `/agenda/address`. An address already
      made keeps working.
- [ ] Ajouter un connecteur MCP from the catalogue: `/connectors/catalog`, `POST /connectors`.
      The v3 lists, checks and removes them only.
- [ ] Renommer un type, ranger des types en groupe: `/kinds/rename`, `/kinds/group`. Par
      l'assistant.
- [ ] Ranger une app dans un domaine: `/apps/area`. Par l'assistant.
- [ ] Actions sur plusieurs entrées à la fois: `/entries/bulk`. Par l'assistant.
- [ ] Créer un partage (a form or a view by link): `/shares`. Par l'assistant. Links already
      shared keep working (`/p/…` is served by the API).
- [ ] Tout fusionner (the kinds that are one): `/kinds/merges/all`. One by one in À valider.
- [ ] Structurer un skill en cinq morceaux, from its line: `/routines/:id/structure`. Par
      l'assistant (`structure_routine`).
- [ ] Poser une question chiffrée dans la recherche: `/answer`. Par l'assistant.
- [ ] Le tableau des habitudes sur 28 jours: `/habits/board`. Habits show in pages (blocks).

## After the gaps: the switch itself

- [ ] Each blocking gap above closed and shown on next.
- [ ] Her data on next checked: migrations 0034–0037, « Lire les offres » under the Chasseur
      d'offres, the bilan skills' triggers (with her yes), Candidatures release 2.
- [ ] Backup of production, then the migrations of V1–F7 and F6b applied to main.
- [ ] `apps/web` served at `/app`; `/v3` sends there.
- [ ] The v2 client (`apps/api/src/platform/client`, about 7 700 lines) and the modules the v3
      merged are deleted in the same change (D20, R4).
- [ ] `docs/product/vision.md` and `docs/ARCHITECTURE.md` say the v3.
- [ ] J-C's green light.
