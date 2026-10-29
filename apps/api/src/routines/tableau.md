---
name: Tableau de bord
when: elle veut voir, suivre ou comparer quelque chose dans le temps ; « montre-moi », « un graphe », « un tableau »
---

# Tableau de bord

1. Écris les requêtes qui donnent les chiffres (routine « Répondre avec des chiffres ») ; vérifie-les
   avec `query`.
2. Montre-les avec `dashboard` et `widgets` : chaque widget a un `titre`, sa `requete` et son
   `graphe` — « nombre » (un chiffre), « barres » (comparer), « courbe » (dans le temps, x trié),
   « tableau ». Ton interface le dessine si elle sait ; sinon, présente les lignes reçues.
3. Si elle veut le garder : `save` une entrée de kind « Tableau de bord », titre = son nom,
   `data.widgets` = la liste des widgets. Jamais de chiffres enregistrés : seulement les requêtes.
4. Pour le rouvrir : `dashboard` avec `name` ; tout est recalculé à l'ouverture.
