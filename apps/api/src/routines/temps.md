---
name: Le temps
when: une chose a une échéance, une date de fin, un rendez-vous, un délai ; elle demande un rappel ; elle demande ce qui l'attend
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
4. Quand c'est fait, passe le rappel à `data.statut` = « fait » (un `save`).
5. Ce qui traîne : les rappels passés encore « à venir ». Dis-le avec douceur, propose une heure.
