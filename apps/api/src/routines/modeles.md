---
name: Les modèles
when: elle veut suivre quelque chose de façon structurée (ses finances, ses habitudes, sa santé, un projet) ; elle demande une app, un système, un tableau de suivi ; un type revient souvent avec des champs qui varient
---

# Les modèles

Un modèle dit une fois pour toutes ce que contient un type. Une fois posé, chaque `save` de ce type
le suit : Jarvis refuse un champ inconnu, une valeur du mauvais type, un champ obligatoire
manquant, un lien vers le mauvais type, un changement d'état non prévu — et dit quoi corriger.
Les noms techniques sont en anglais : mots-clés, kinds, fields et options d'une app (`Transaction`,
`amount`, `out`). Ce qu'elle lit vient des `label` en `fr` et `en` : un model a `label`, chaque field
`label` et, pour un `choice`, `optionLabels` (`{ out: { fr: 'sortie', en: 'out' } }`). Ses propres
entrées (titres, textes) restent dans ses mots.

1. Avant de proposer un modèle, appelle `kinds` : pars des types et des champs qu'elle a déjà, et
   de ses mots. Un type par nature de chose, au singulier (« Mouvement », « Habitude », « Compte »).
2. Propose-lui le modèle en clair (les champs, ce qui est obligatoire, les choix, les liens, les
   calculs) et attends son accord. Puis un `save` : une entrée de kind « Model », titre = le type,
   `data` =
   - `label` : `{ fr, en }` ;
   - `fields` : `[{ name, type, label?, required?, options?, optionLabels?, target?, cardinality?,
inverse?, formula?, fields?, unit?, help?, default?, min?, max?, unique?, action? }]` ; `type`
     parmi text, long_text, number, amount, date, datetime, time, duration, choice, multi_choice,
     boolean, list, link, formula, lines, url, email, phone, file, location, rating, progress, button ;
   - les options d'un field : `default` (une valeur, ou « =today() »), `min` / `max`, `unique`
     (deux entrées ne partagent pas la valeur — pour ne pas postuler deux fois à la même offre) ;
   - `path` (facultatif) : où l'export range chaque entrée, avec `{year}`, `{month}`, `{day}`,
     `{date}`, `{title}`, `{id}` ou un champ (« finances/{year}/{month}/{title}.md ») ;
   - `columns`, `total`, `groupBy` : comment l'app montre ce type ; `app` : l'app à laquelle il
     appartient (« Finances ») ; `open` : true seulement si elle veut des champs libres ;
   - `workflow` (facultatif) : `{ field, initial?, transitions: [{ from, to, if? }] }`.
3. Un `amount` est un nombre avec sa devise dans `unit` ; une `date` est « 2026-10-30 » ; un
   `datetime` « 2026-10-30T14:00 » ; une `time` « 07:15 » ; une `duration` des minutes. Un `url`
   commence par https:// ; un `email`, un `phone` sont cliquables ; un `multi_choice` est une liste
   parmi ses `options` ; un `rating` va de 0 à 5 (ou `max`) ; un `progress` de 0 à 100 ; un `file`
   est l'id d'une entrée fichier (après `upload_link`) ; une `location` est `{ address?, lat, lng }`
   (donne les coordonnées que tu connais, origin « inferred », et dis-le). Un `button` n'est jamais
   écrit : `action` `{ set?, rule?, script?, label? }` dit ce qu'il fait ; `press` l'appuie (sur sa
   demande). Le temps reste dans les champs de
   l'agenda (`start`, `at`, `due`, `repeat`…) : ils sont admis par tout modèle.
4. **Relations.** Un champ `link` (`target` : le type visé, `cardinality` : `one` par défaut ou
   `many`, `inverse` : le nom par lequel l'autre côté le lit) n'est pas une valeur : dans `save`,
   donne l'id de l'entrée visée (ou le `ref` d'une entrée du même `save`), une liste pour `many`,
   `null` pour défaire ; Jarvis en fait un lien dont le rôle est le nom du champ. Exemple :
   `Mouvement.compte` `{ type: link, target: Compte, inverse: mouvements }` — un compte lit alors
   ses `mouvements`.
5. **Calculs.** Un champ `formula` n'est jamais écrit : il est calculé à chaque lecture.
   `solde_initial + sum(mouvements.montant where nature = 'entrée') - sum(mouvements.montant where
nature = 'sortie')`. Fonctions : sum, avg, count, min, max (avec `where`), if, coalesce, round,
   abs, today, month, year, this_month, last_days, days_between, date_add, since, lower, contains,
   len, streak. Un nom avec des espaces s'écrit entre `` ` ``. Les chiffres viennent de là ou de
   `query` — jamais de ta tête.
6. **Lignes.** Un champ `lines` (`fields` : les champs d'une ligne) garde le détail d'une facture,
   d'une liste de courses : `[{ article: 'Riz', montant: 1200 }]` ; `sum(lignes.montant)` les totalise.
7. **États.** Un `workflow` sur un champ `choice` dit l'état de départ et les passages permis
   (« brouillon → validée si total > 0 », « validée → payée ») ; Jarvis refuse les autres.
8. Une app, c'est plusieurs modèles reliés (Finances : Compte, Fonds, Mouvement, Obligation,
   Rapprochement ; Routines : Habitude, Pointage) avec ses pages et ses règles (routine « Les
   apps »). Construis-la pas à pas avec elle : un modèle, quelques entrées réelles, puis le suivant.
9. Changer un modèle, c'est changer son entrée « Model » (après lui avoir demandé). Si un nom de
   champ change, corrige les entrées avec `migrate` (routine « Les apps »). Tout est journalisé et
   s'annule.
10. Si `save` refuse une entrée, ne contourne pas : lis la phrase, corrige le nom ou la valeur, ou
    demande-lui s'il faut changer le modèle. Si `save` répond des `notes` (anciens mots-clés
    renommés), écris désormais les nouveaux.
