---
name: Le temps
when: une chose a une échéance, une date de fin, un rendez-vous, un délai ; elle demande un rappel, une fois ou qui revient ; elle demande ce qui l'attend, son agenda, sa semaine
---

# Le temps

Les mots-clés du temps sont en anglais : `start`, `end`, `duration`, `at`, `due`, `date`,
`repeat`, `except`, `until`, `timezone`, et l'état `status` : `planned`, `proposed`, `done`,
`cancelled` (`sent`, `failed`, `to_fix` pour les rappels).

1. Une échéance (passeport qui expire, dossier à déposer, loyer) : garde la date dans l'entrée,
   puis calcule « agir avant » = échéance moins le délai réel (renouvellement, traitement). Si tu ne
   connais pas le délai, demande-le ou cherche-le, et dis-le.
2. Pose un rappel : une entrée de kind « Rappel », titre = ce qu'il faudra faire, `data.at` = date
   et heure ISO (ex. « 2026-11-03T09:00 »), `data.status` = `planned`, lien « pour » vers la chose.
   Par défaut, rappelle à J-90, J-30 et J-7 d'une échéance importante.
3. Ce qui l'attend (« qu'ai-je jeudi ? », « ma semaine ») : l'outil `agenda` sur la période —
   jamais de mémoire. Il rassemble toute entrée datée, quel que soit son kind.
4. Un rendez-vous qui revient (« chaque soir à 20h45 sauf le samedi », « le lundi à 7h15 », « le
   dernier jour du mois à 19h30 ») : un seul « Rappel » avec `data.repeat` en cinq champs — minute,
   heure, jour du mois, mois, jour de la semaine (0 = dimanche) : « 45 20 * * 0-5 », « 15 7 * * 1 »,
   « 30 19 L * * » (L = dernier jour). `data.message` = ce qu'il faudra lui dire ; `data.timezone`
   si elle n'est pas à l'heure de Paris (« Africa/Abidjan »). Jarvis calcule `data.next` et le lui
   envoie à l'heure, sur son canal (Telegram) ; dis-lui la prochaine fois en clair.
5. Quand c'est fait, passe le rappel à `data.status` = `done` (un `save`). Pour arrêter un rappel
   qui revient : `cancelled`. Un rappel `to_fix` porte `data.error` : corrige `repeat` ou `at`,
   puis remets `data.status` à `planned`.
6. Ce qui traîne : les rappels passés encore `planned`. Dis-le avec douceur, propose une heure.
7. Le temps est un champ, pas un kind : n'importe quelle entrée entre dans son agenda par ses champs.
   - Un rendez-vous, une session, un culte : `data.start` (« 2026-10-29T14:00 ») et `data.end`, ou
     `data.duration` en minutes (« 90 », « 1h30 »). Garde le kind qu'elle emploie (« Événement »,
     « Rendez-vous », « Session »), lie-le à la personne ou au projet.
   - Une échéance : `data.due` (un jour seul = toute la journée). Un jour qui revient chaque année
     (anniversaire) : `data.repeat` « 0 9 1 11 * ».
   - Une habitude ou un bloc du gabarit (« gym mardi et mercredi 18h30, 1h30 ») : `data.repeat`
     « 30 18 * * 2,3 » et `data.duration` 90 ; `data.except` = les jours sautés (« 2026-11-04 ») ;
     `data.start` et `data.until` bornent la période.
   - Ce que tu proposes sans qu'elle l'ait demandé (un créneau pour avancer, un report) :
     `data.status` `proposed` ; elle accepte (`planned`) ou refuse (`cancelled`).
8. Son agenda sur son téléphone : dans l'app, « Agenda » → « Ajouter à mon agenda » donne une adresse
   privée que Google Agenda ou l'iPhone suivent. Ne lui demande jamais cette adresse.
