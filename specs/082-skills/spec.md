# 082 — « Skills », seen clearly

## Why

The author, 17 Nov: « Dans notre cas, comment sont gérés les skills ? On devrait voir clairement la
section… des manières qu'on dit à l'IA de fonctionner en fonction de la tâche qu'on lui demande. »
They existed as routines (spec 047) and Jarvis's base routines, but were seen nowhere as such.

## What changes

1. **« Skills »** in the sidebar (Ma vie): how the AI works for each thing she asks — what starts it,
   what it does, what it makes.
2. Three tabs:
   - **Les tiens**: the routines of her spaces — name, the start of their instructions, what starts
     them (her phrases, a set time, a kind saved), what they make (« Bilan »…), their space. One
     opens in the side card.
   - **De Jarvis**: Jarvis's base routines, read in a drawer as formatted text.
   - **Des apps**: what each installed app tells the assistant, with a link to the app's role.
3. **« Nouveau skill »**: a name, what she says to start it, or a set time, what the AI must do (in
   Markdown), what it makes, its space — kept as a routine of five parts, read by every assistant.

`GET /api/skills` gives the three lists.

## Proof

A skill « Bilan de la semaine » written from the page (« /bilan », « chaque samedi à 18h », result
« Bilan ») appears in « Les tiens »; checked at 1440 and 390 px.
