# 092 — Living documents, people, settings (v3 D5, D8, D15, D16, V7)

## Step back

Three needs, each served by one generic piece, not by a screen written for one app:

- **A document is understood once, for every app.** A dropped file is read (spec 026), then its
  genre and facts are kept on it, each fact with the words it came from. An invoice proposes what
  it makes, in her kinds (an app's Bill and Warranty, else the common Transaction), to her yes.
  The rules are the floor: an assistant reads better through the same door (`propose`).
- **Who someone is comes from the « who » facet.** One `Identity` (avatar, real logo, the
  workplace's logo in the corner) and one `WhoActions` (write, call, open the site, each a real
  link) appear wherever a row has the facet: the list, the new **Cartes** render, the Fiche.
- **The Fiche is drawn from facets.** It shows:
  - who it is;
  - what a document is and says;
  - its values in her words, marked « lu, à vérifier » when read rather than said;
  - its links both ways;
  - the files joined to it;
  - its history.

## What changes

1. **Reading → proposal** (`read-documents.ts`):
   - `readFacts` finds the genre (facture, devis, contrat, ordonnance…), amount, date, due date,
     supplier (a work address or site, never a personal mailbox) and warranty.
   - `understandFile` keeps them on the file (origin `read`), recognises the supplier among her
     organisations (by site, then by name), and proposes the bill (or the expense), the supplier
     if new, and the warranty, linked « pièce de » and « chez ».
   - It runs right after the drop, out of the request, and in the watcher's pass.
   - `POST /files/:id/understand` reads a file again.
2. **Dépôt partout**: a file dragged onto any screen is kept. On a Fiche it is joined to that
   entry. A notice says what happened, and the views refresh when the reading proposes something.
3. **Logos**: `GET /api/logo/:domain`. Jarvis fetches the site's own icon, so her browser never
   calls a third party.
   - It tries the touch icon, then the favicon, then the icon declared in the home page.
   - Only public addresses are reached (the address checked is the one connected to), over HTTPS,
     200 KB at most, within 4 s.
   - Icons are kept 7 days; a site without one shows its initial on its colour.
4. **Personnes**: all who-kinds as cards, a list or a table. Her circles (`circle`) appear as chips,
   and a multiple choice filter now matches when it holds the value. Kinds kept without a model now
   show their fields, named in French. A file or a company linked to someone is no longer « the
   last contact ».
5. **Réglages**, four tabs kept in the URL:
   - **Compte**: time zone, linking Telegram, export everything.
   - **Espaces et membres**: name, purpose, colour; members with their roles; leaving or removing
     someone; an invitation as a link to give (Jarvis sends nothing).
   - **Connexions**: each with its state, last answer and failures, and the actions Vérifier,
     Se reconnecter, Relire (ICS) and Couper; plus the services to link.
   - **Assistants**: the assistants that reach Jarvis (access removable) and her personal keys, each
     shown once.
   - After a Google sign-in, the v3 comes back to its Connexions tab.
6. Shared UI: `Tabs`, `inputClass`, `Identity`, `Logo`, `WhoActions`, `CardsRender`.

## Not yet

- Rights per kind or per entry: roles are per space.
- Agents as members: V8.
- Editing in place on the Fiche.

## Proof

Core tests (`read-documents.test.ts`):

- genre and facts with their words;
- read once;
- the proposal makes the Bill and the Warranty, with the known supplier linked and values « lu ».

In the real app, a PDF invoice from Darty was dropped. A few seconds later it showed:

- genre « facture »;
- 649,90 €, due 26 Nov., the 2-year warranty;
- Darty recognised;
- the proposal in « À valider ».

« Accepter » made « Facture Darty » and « Garantie Darty », joined to the file.

Also checked in the real app:

- people as cards, with logos (Doctolib, Ynov) and circles;
- a file joined on a person's page;
- a « Famille » space created and an invitation made.

Checked at 1440, 1024 and 390 px, with no overflow and no page error.
