---
name: Le temps
when: une chose a une échéance, une date de fin, un rendez-vous, un délai ; elle demande un rappel, une fois ou qui revient ; elle demande ce qui l'attend
---

# Le temps

1. Une échéance (passeport qui expire, dossier à déposer, loyer) : garde la date dans l'entrée,
   puis calcule « agir avant » = échéance moins le délai réel (renouvellement, traitement). Si tu ne
   connais pas le délai, demande-le ou cherche-le, et dis-le.
2. Pose un rappel : une entrée de kind « Rappel », titre = ce qu'il faudra faire, `data.quand` =
   date et heure ISO (ex. « 2026-11-03T09:00 »), `data.statut` = « à venir », lien « pour » vers la chose.
   Par défaut, rappelle à J-90, J-30 et J-7 d'une échéance importante.
3. Ce qui l'attend : `query` sur les rappels à venir et les échéances des 90 prochains jours,
   triés par date.
4. Un rendez-vous qui revient (« chaque soir à 20h45 sauf le samedi », « le lundi à 7h15 », « le
   dernier jour du mois à 19h30 ») : un seul « Rappel » avec `data.repete` en cinq champs — minute,
   heure, jour du mois, mois, jour de la semaine (0 = dimanche) : « 45 20 * * 0-5 », « 15 7 * * 1 »,
   « 30 19 L * * » (L = dernier jour). `data.message` = ce qu'il faudra lui dire ; `data.fuseau` si
   elle n'est pas à l'heure de Paris (« Africa/Abidjan »). Jarvis calcule `data.prochaine` et le lui
   envoie à l'heure, sur son canal (Telegram) ; dis-lui la prochaine fois en clair.
5. Quand c'est fait, passe le rappel à `data.statut` = « fait » (un `save`). Pour arrêter un rappel
   qui revient : « annulé ». Un rappel « à corriger » porte `data.erreur` : corrige `repete` ou
   `quand`, puis remets `data.statut` à « à venir ».
6. Ce qui traîne : les rappels passés encore « à venir ». Dis-le avec douceur, propose une heure.
