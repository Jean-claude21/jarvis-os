# Spec 060 — Capabilities: she says what she wants, Jarvis picks the services

**Status**: implemented · **Date**: 2026-11-14

People never activate a service by its name. They say what they want (« je cherche un stage en IA
à Rouen »). Her apps declare the capabilities they use, an assistant picks from what each
capability says it can do, and Jarvis reaches its Atelier itself (Jarvis Atelier, its own repo).

```
« trouve-moi un stage »  →  app Candidatures (declares offres_emploi, lire_page, pdf)
                         →  plan in plain words → her yes → Jarvis wires it: types, rule, calls
```

## US1 — Jarvis reaches its Atelier itself (P1)

With `ATELIER_URL` and `ATELIER_KEY` set on the server:

- A rule's `call` to `connection: "Atelier"` reaches the Atelier when she has no connection of
  that name. She never creates or sees one.
- The path is `/jobs/<capability>`, called with Jarvis's key.
- Long work carries its work token and `jarvis.url`, as in spec 057.

## US2 — Apps declare their capabilities (P1)

An app's role has `capabilities: ["offres_emploi", …]`.

`GET /api/capabilities` and the MCP tool `capabilities` (with no `run`) list the Atelier's
catalogue. Each capability comes with what it does in her words (`does`, `examples`), its `effect`,
its input, whether it is ready, and the apps that use it.

## US3 — A capability run from a conversation (P1)

`capabilities { run, input, save?, about?, agreed? }`:

- **Short work** answers at once.
- **Long work** opens an Execution (seen in « Activités »). Its work token may write the `save`
  kind (else the capability's own) and nothing else. The Atelier writes what it finds and closes
  the execution.
- A file it makes (a PDF) is sent to `POST /api/files` with that token, linked `made_by` to the
  execution. Work tokens may now post files, within their kinds.
- An `effect: sends` capability needs `agreed: true`, after her yes.

## US4 — The app « Candidatures » (P1)

| Kind          | Label               | Content                                                                                                                  |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `JobSearch`   | Profil de recherche | poste, lieu, contrat, début                                                                                              |
| `JobOffer`    | Offre               | entreprise, lieu, url (unique), publiée, source, score and its reasons, suite: nouvelle / à creuser / postulée / écartée |
| `Application` | Candidature         | an activity, linked to its offer; où j'en suis, envoyée le, `due` = relancer le, réponse, contact, notes                 |

Rules:

- « Offres du matin »: at 7:00, call `Atelier /jobs/offres_emploi`, including her `JobSearch`
  entries, long. What is found is saved as `JobOffer` by `url`, titled « {title} — {company} ».
- « Relance d'une candidature »: on the `due` day of a waiting application, a reminder.

Page « Mes candidatures »:

- the offers to look at and the applications under way (counts);
- the new offers with score ≥ 50 (one gesture: « À creuser »);
- the interesting ones, by score;
- the applications on a kanban;
- the form « Ce que je cherche ».

Capabilities: `offres_emploi`, `lire_page`, `pdf`. Nothing is sent to a recruiter without her yes.

## Assistant instruction

When she wants something done rather than kept, the assistant:

1. calls `capabilities`;
2. picks what fits;
3. says in plain words what will happen;
4. runs it after her yes.

It never asks her to name or connect a service.
