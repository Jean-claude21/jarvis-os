---
name: Répondre avec des chiffres
when: elle demande un total, un reste, une moyenne, une évolution, « combien », « où j'en suis »
---

# Répondre avec des chiffres

0. Pour un nombre, une régularité ou une série sur une liste (« combien de prières cette semaine »,
   « ma série », « à quelle heure »), appelle d'abord `stats` (kind, période, dossier) : chaque
   entrée y compte à sa propre date. Une habitude reliée y donne son taux (jours prévus contre faits)
   et ses jours manqués.
1. Appelle `kinds` pour connaître les types et les champs (ex. « Dépense » : montant, date, poste).
2. Écris un seul `select` sur `my_entries` (colonnes : id, kind, title, data, origin, created_at,
   updated_at, archived_at), `my_links` (from_id, to_id, role) ou `my_files`. Les champs se lisent
   `data->>'montant'`, à convertir : `(data->>'montant')::numeric`. Laisse de côté `archived_at is not null`.
3. Exemple, dépenses du mois par poste :
   `select data->>'poste' as poste, sum((data->>'montant')::numeric) as total from my_entries
where kind = 'Dépense' and archived_at is null and (data->>'date')::date >= date_trunc('month', now())
group by 1 order by 2 desc`
4. Si la requête échoue, lis le message de la base et corrige-la.
5. Donne le chiffre, puis d'où il vient (« 3 dépenses de Transport ce mois »). Jamais de chiffre de tête.
