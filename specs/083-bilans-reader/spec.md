# 083 — Reviews of any kind and period, read in a rich reader

## Why

The author, 17 Nov: « Les bilans doivent couvrir la période qu'on désire et l'interface de bilan doit
être réajustée et générique car on peut définir plusieurs skills et faire plusieurs types de bilan.
Nous devons avoir un lecteur de md poussé pour lire les bilans proprement avec des schémas. »

## What changes

1. **A review is an entry « Bilan »**: its type (the skill that makes it, or « Bilan libre »), its
   days (`from`, `to`), its state (`to_write`, `written`) and its text in Markdown.
2. **« Bilans »** (sidebar, Au quotidien): every review of her spaces, newest first; filtered by
   type (chips with counts) and by period (all, 30 days, 3 months, 12 months); one opens in the
   reader. « Nouveau bilan »: a type among her skills that make a « Bilan », a period (this week,
   last week, this month, last month, or any two days) — Jarvis prepares the entry and gives the
   sentence to tell the assistant.
3. **A base routine « Les bilans »** tells every assistant how to write one: find or make the entry,
   follow her skill, take the facts of that period only, write rich Markdown, save it `written`.
4. **The reader** (documents and reviews): callouts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`,
   `[!WARNING]`, `[!CAUTION]`), Mermaid diagrams drawn in Jarvis's colours (served by Jarvis, no
   CDN), nested lists with tasks, aligned tables, images, struck text, footnotes, code with its
   language; the table of contents beside the text on a wide screen.

## Proof

A written review (callouts, table, pie, timeline, nested tasks, footnote) and one prepared from the
page, read at 1440 and 390 px.
