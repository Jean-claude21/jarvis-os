---
name: Les apps
when: elle veut une app (finances, routines, santé, projet…), un tableau de bord, une page de suivi, une règle automatique (« préviens-moi quand… », « chaque mois crée… »), un import de fichier (relevé de banque), ou changer la forme de ses données
---

# Les apps

Une app, c'est des données que tu écris avec elle — jamais du code chez elle : des modèles (routine
« Les modèles »), des pages, des règles, au besoin des scripts. Jarvis vérifie tout, calcule les
chiffres, journalise chaque changement et peut tout annuler.

1. **Commence par ce qui existe.** `app_install` sans `dryRun: false` montre ce qu'une app livrée
   avec Jarvis créerait (Finances, Routines) : propose-la si elle convient, installe après son oui,
   puis ajuste avec elle (un champ, un choix, un fonds). Sinon construis pas à pas : un modèle,
   quelques entrées réelles, une page, puis une règle.
2. **Une page** : une entrée de kind « Page », titre = son nom technique en anglais (« Month
   overview »), `data` = `{ app, label: { fr, en }, order?, filters?: [{ name, type:
month|choice|text, options?, default?, label? }], blocks }`. Le `title` d'un block est
   `{ fr, en }`.
   Les blocs :
   - `stat` (un chiffre), `stat_delta` (un chiffre et son écart avec le mois d'avant), avec une
     `query` ;
   - `gauge` (`kind`, `value`, `max` : des formules de chaque entrée — un budget, un objectif) ;
   - `bar`, `line` (dans le temps), `breakdown` (la part de chacun), avec une `query` groupée ;
   - `table` (`query`, `total`?), `task_list` (`kind`, `where`, `detail`, `action: { label,
set }` — un geste d'un clic), `kanban` (`kind`, `by` : un champ choice), `heatmap` (`kind`,
     `date`, `days`), `calendar` (`days`), `form` (`kind`), `record`.
     Une `query` = `{ kind, where?, groupBy?, aggregate?, fields?, sort?, limit? }` : `where` et
     `groupBy` sont des formules (« sens = 'sortie' and month(date) = {month} », « fonds.title »,
     « month(date) ») ; `aggregate` = `{ total: "sum(montant)", n: "count()" }` ; `{month}` reçoit le
     filtre de la page. Montre la page avec `page` (elle s'affiche chez elle, filtres et gestes
     compris) ; dans l'app web, elle apparaît dans son app.
3. **Une règle** : une entrée de kind « Rule », `data` = `{ when, if?, then, active? }`.
   - `when` : `{ saved: kind }`, `{ changed: { kind, field } }`, `{ schedule: "0 8 1 * *" }` (cinq
     champs, comme `repeat`), `{ before: { kind, field, days } }`.
   - `if` : une formule de l'entrée (« fonds.reste < 0 »).
   - `then` : `{ create: { kind, title, data?, link? } }`, `{ update: { set, on? } }` (`on` : un link,
     « product » — l'entrée liée est changée, ses noms d'abord : « =stock - quantity »), `{ link: { to, role }
}`, `{ remind: { text, at? } }`, `{ run_script: { script, params? } }`. Dans un texte,
     `{formule}` est remplacé (« Le fonds {fonds.title} est dépassé de {-fonds.reste} ») ; une
     valeur « =formule » est calculée.
     Essaie-la avec `rule_test` sur une entrée avant de lui dire qu'elle marche. Une règle ne se
     déclenche pas sur son propre changement ; les règles s'enchaînent sur trois niveaux au plus.
     Préfère proposer (`remind`, `status: proposed`) plutôt qu'agir à sa place.
4. **Un script**, seulement quand le reste ne suffit pas (lire un relevé, un calcul très à elle) :
   une entrée de kind « Script », `data` = `{ description, reads: [kinds], writes: [kinds], code }`.
   Le code définit `function run(input)` : `input` = `{ entries: { Kind: [{ id, title, data,
computed }] }, file: { name, text }, entry, params, today }` ; il rend une liste de changements
   `{ create: { ref?, kind, title, data } }`, `{ update: { id, data } }`, `{ link: { from, to, role }
}`, `{ remind: { text, at? } }`. Pas de réseau, pas d'horloge, 2 secondes, `log(...)` pour
   déboguer. Lance-le avec `run_script` (essai par défaut), montre-lui le résultat, puis
   `dryRun: false` après son oui.
5. **Changer la forme de ses données** : change d'abord le modèle (avec elle), puis `migrate`
   (`rename`, `set`, `remove`) — l'essai dit combien d'entrées changent et lesquelles ne suivraient
   pas le modèle. Une migration s'annule d'un coup.
6. **Une view** (ce qu'elle explore elle-même dans l'app) : `view` avec `{ kind, type:
table|kanban|calendar|map|gallery|timeline|tree, filters: [{ field, op, value? }], sort, columns,
groupBy, location?, image?, start?, end?, parent? }` — un filter
   peut passer par un link (« fund.title »). Pour la garder : une entrée de kind « View »,
   `data` = la même chose + `app`, `label` `{ fr, en }`, `default` ; elle devient un onglet de l'app.
7. **Ranger une app** : `area` sur ses models (« Personnel », « Professionnel » — ses mots) ;
   l'app les groupe dans la barre latérale.
8. **Une collection** : tout kind qui a un model s'ouvre seul dans l'app (« Collections »), avec
   ses statistiques tirées du model ; `collection_stats` te les donne. Pas besoin d'une app pour
   suivre une seule chose. Une page peut aussi contenir une view : block `{ block: 'view', view }`.
9. **Un lien public** (`share`) — seulement après son oui explicite, car n'importe qui avec le lien
   y accède : un formulaire (`mode: form`, `kind`, `fields`) — ce qu'on envoie arrive « proposé »,
   à valider —, ou une view à lire (`mode: view`). Elle le ferme quand elle veut.
10. **Les distances et les devises** : `distance(a, b)` donne les km à vol d'oiseau entre deux
    `location` (compte 1,3 à 1,5 fois plus par la route) ; `convert(montant, 'EUR', 'XOF')`
    convertit (XOF, XAF, EUR fixes ; les autres viennent de ses entrées « Rate » `{ currency,
per_eur }` — demande-lui le taux, n'en invente pas).
11. **Un espace partagé** : `set_role` rend un membre `viewer` (il lit sans écrire), sur sa demande.
12. **Partager une app** : `app_export` la rend en un paquet (modèles, pages, règles, scripts) qu'une
    autre personne ou un autre espace installe avec `app_install` et `bundle`.
13. Les chiffres viennent des formules, des pages ou de `query` — jamais de ta tête. Si un bloc
    montre une erreur, lis-la et corrige la page.
