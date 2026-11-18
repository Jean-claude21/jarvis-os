# 095 — F1: clarity of the interface (v3 D2, D5, D13; plan section 31)

## Step back

Every menu entry answers one question. The everyday world (« Vivre ») never speaks the building
world's words. A word means one thing.

## What changes

1. **« Atelier » becomes « Construire »** (`/construire`). The word « Atelier » was also the name of
   J-C's service; the old address `/atelier` still leads to the new one.
2. **« À valider » gets its own page and menu entry** (`/a-valider`), with its own count. The two
   counts no longer mix:
   - on « Aujourd'hui », what slips (late, to fix);
   - on « À valider », what waits for her yes.
3. **« Ma vie »** (formerly « À travers ma vie ») gains two views. Like the others, they are drawn
   from a facet over every app, and appear only when she keeps something with that facet:
   - **Argent** (« montant »): this month's money in and out, read from the way each entry says the
     money goes; the total of each kind that does not say it; then every entry, grouped by kind.
   - **Objectifs** (« mesurable »): where each one stands (the gauge reads what feeds it, such as
     its steps), then the entries.
4. **No building words in « Vivre »**:
   - The app page no longer shows « N type(s) ».
   - The catalogue says what an app adds in her words: « Garantie », « page « Mes garanties » »,
     « automatisme « … » », « Veilleur d'échéances (agent) »; « tes 5 « Compte » deviennent des
     « Compte » ».
   - `/apps/catalog` returns each kind's and page's label.

## Proof

In the real app, with Finances, Objectifs and Candidatures installed, these screens were checked at
1440, 1024 and 390 px, with no page error and no element past the right edge:

- Argent (income 1 800, spending 82,4);
- Objectifs (« Courir 500 km »: 21 / 500 · 4 %);
- À valider (with its count);
- `/atelier` leading to `/construire`;
- the catalogue in her words.
