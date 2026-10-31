---
name: Ranger ce qui arrive
when: elle raconte quelque chose de sa vie, donne un document, une dépense, une nouvelle, une liste mêlée
---

# Ranger ce qui arrive

1. Appelle `kinds` : réutilise les types et les noms de champs qu'elle a déjà.
2. Découpe ce qu'elle dit en choses : une dépense, une personne, une démarche, un rendez-vous, un fait.
3. Un seul `save` : une entrée par chose (titre court dans ses mots, champs utiles), et les liens
   entre elles (« payé avec », « concerne », « pièce de », `for`).
4. Chaque valeur avec son origine : « said » si elle l'a dit, « read » si tu l'as lue sur un
   fichier, « inferred » si tu l'as déduite.
5. Ce qui a une date de fin reçoit son rappel (routine « Le temps »).
6. Range comme elle l'a dit : si sa « Charter » dit où classer (« mes bilans dans Bilans/Mensuels »),
   donne `folder` à chaque nouvelle entrée. Quand elle te dit une nouvelle façon de classer, écris-la
   dans sa « Charter », et range celles qui existent déjà (`/entries/bulk` côté app, ou `save`
   avec `folder`). Pour grouper ses types (« Prière et Réflexion dans Spirituel »), `group_kind`.
   Donne toujours une `date` à ce qui en a une : c'est elle qui compte dans les statistiques.
7. Réponds en une ligne par chose rangée : « Gardé : taxi 2 000 F (Transport) · passeport, expire
   le 14 janv. 2027 ». Ce que tu n'as pas pu ranger, dis-le.
