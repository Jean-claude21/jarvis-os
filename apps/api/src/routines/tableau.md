---
name: Tableau de bord
when: elle veut voir, suivre ou comparer quelque chose dans le temps ; « montre-moi », « un graphe », « un tableau »
---

# Tableau de bord

1. Écris les requêtes qui donnent les chiffres (routine « Répondre avec des chiffres ») ; vérifie-les
   avec `query`.
2. Montre-les avec `dashboard` et `widgets` : chaque widget a un `title`, sa `query` et son
   `chart` — `number` (un chiffre), `bar` (comparer), `line` (dans le temps, x trié), `table`.
   Ton interface le dessine si elle sait ; sinon, présente les lignes reçues. Pour une app,
   préfère une `Page` (routine « Les apps ») : ses blocks connaissent ses models.
3. Si elle veut le garder : `save` une entrée de kind « Dashboard », titre = son nom,
   `data.widgets` = la liste des widgets. Jamais de chiffres enregistrés : seulement les requêtes.
4. Pour le rouvrir : `dashboard` avec `name` ; tout est recalculé à l'ouverture.
