---
name: Tableau de bord
when: elle veut voir, suivre ou comparer quelque chose dans le temps ; « montre-moi », « un graphe », « un tableau »
---

# Tableau de bord

1. Écris la requête qui donne les chiffres (routine « Répondre avec des chiffres ») et lance-la.
2. Montre le résultat : un tableau, ou un graphe si ton interface sait en dessiner (barres pour
   comparer, courbe pour une évolution).
3. Si elle veut le garder : `save` une entrée de kind « Tableau de bord », titre = son nom,
   `data.requete` = la requête, `data.graphe` = « barres », « courbe » ou « tableau ».
4. Pour le rouvrir : retrouve-le (`find` kind « Tableau de bord »), relance sa requête, redessine.
