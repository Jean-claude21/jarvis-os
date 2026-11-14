# 073 — Candidatures, laid flat

## Why

The app grew step by step and became hard to follow: three scores, three statuses for one thing, a
grid that only judged CVs, eight kinds. Her process is simple. This spec rebuilds the app on it.

## The process

1. **Collect**, every morning, without AI. Jarvis and the Atelier read her sites for her searches,
   then each kept offer whole. One offer is one entry, however many sites show it.
2. **Appraise**, by a Claude routine. It reads each new offer's content and her criteria, and gives
   a note out of 100 and why. Above her threshold, the offer moves to « à postuler » on its own.
3. **Prepare**, by the same routine. For each offer « à postuler » (hers or the threshold's), it
   writes a tailored CV and grades it with her CV criteria. At 80 or more, it makes the PDF. Both are
   linked to the offer. Nothing is sent.
4. **She decides and applies**, in Jarvis.

## The model: five kinds

| Kind                    | Holds                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `JobSearch` (Recherche) | role, place, contract, her words, her types                                                   |
| `Source` (Site)         | link, search address, recipe, read or paused, notes                                           |
| `Criterion` (Critère)   | for an offer or for a CV; weight, what the AI checks, order                                   |
| `JobOffer` (Offre)      | everything about one offer, from the collection to the answer                                 |
| `CV`                    | the master CV, the templates, the tailored CVs (linked to their offer), their grade and state |

Her thresholds live in one `JobSettings` entry (Réglages):

- `seuil_postuler` (75): the note above which an offer moves to « à postuler » on its own;
- `seuil_pdf` (80);
- `notes_par_jour` (30);
- `cv_par_jour` (3);
- `villes`.

### An offer's life: one field, `status`

| Value       | Means      |
| ----------- | ---------- |
| `new`       | nouvelle   |
| `rated`     | appréciée  |
| `to_apply`  | à postuler |
| `cv_ready`  | CV prêt    |
| `applied`   | postulée   |
| `interview` | entretien  |
| `refused`   | refusée    |
| `accepted`  | acceptée   |
| `dismissed` | écartée    |

### An offer's fields

| Part           | Fields                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Collected      | title, company, location, url, published, contract, type, source, position, fingerprint, `contenu`             |
| Keyword filter | `score`, « Pertinence (mots-clés) », and `reasons`. Not a ranking: it only decides what is read and appraised. |
| Appraised      | `adequation` (Note, 0–100) and `avis_ia` (Pourquoi)                                                            |
| Applied        | `sent_on`, `follow_up`, `answer`                                                                               |

The « Application » kind is gone: an offer carries its application.

## Rules

| Rule            | When           | What                                                           |
| --------------- | -------------- | -------------------------------------------------------------- |
| Offres du matin | 7:00           | collect; match by fingerprint, then address; place the town    |
| Lire les offres | 7:30           | full content of kept offers (keyword score 100, not set aside) |
| Relance         | on `follow_up` | a reminder, if the offer is still « postulée »                 |

## Pages

| Page              | Shows                                                               |
| ----------------- | ------------------------------------------------------------------- |
| À décider         | the offers to decide on, best note first, as a list with its record |
| À postuler        | the offers to apply to with their CV, and the tailored CVs          |
| Postulées         | applications, follow-ups, answers                                   |
| Toutes les offres | the data table, every offer                                         |
| Suivi             | the funnel of steps, offers per day, by type, by site               |
| Réglages          | her settings, her criteria, her searches, her sites                 |

The map stays a saved view.

## Migration

Her entries stay. The app is removed, then the new one installed. Her offers keep their values:
`new`, `applied` and `dismissed` keep their meaning, and `interesting` becomes `to_apply`. Her CV
criteria become `pour: cv`, and the offer criteria are added.
