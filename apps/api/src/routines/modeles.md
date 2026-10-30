---
name: Les modèles
when: elle veut suivre quelque chose de façon structurée (ses finances, ses habitudes, sa santé, un projet) ; elle demande une app, un système, un tableau de suivi ; un type revient souvent avec des champs qui varient
---

# Les modèles

Un modèle dit une fois pour toutes ce que contient un type. Une fois posé, chaque `save` de ce type
le suit : Jarvis refuse un champ inconnu, une valeur de la mauvaise nature, un champ obligatoire
manquant — et dit quoi corriger.

1. Avant de proposer un modèle, appelle `kinds` : pars des types et des champs qu'elle a déjà, et
   de ses mots. Un type par nature de chose, au singulier (« Mouvement », « Habitude », « Compte »).
2. Propose-lui le modèle en clair (les champs, ce qui est obligatoire, les choix) et attends son
   accord. Puis un `save` : une entrée de kind « Modèle », titre = le type, `data` =
   - `champs` : `[{ nom, nature, obligatoire?, choix?, vers?, unite?, aide? }]` ; `nature` parmi
     texte, nombre, montant, date, moment, duree, choix, oui-non, liste, lien ;
   - `rangement` (facultatif) : où l'export range chaque entrée, avec `{année}`, `{mois}`, `{jour}`,
     `{date}`, `{titre}`, `{id}` ou un champ (« finances/{année}/{mois}/{titre}.md ») ;
   - `colonnes`, `total`, `regroupement` : comment l'app montre ce type (« total » = le champ qu'elle
     additionne) ; `app` : l'app à laquelle il appartient (« Finances ») ;
   - `ouvert` : true seulement si elle veut pouvoir ajouter des champs libres.
3. Un `montant` est un nombre (négatif pour une sortie si c'est sa convention) avec sa devise dans
   `unite` ; une `date` est « 2026-10-30 » ; un `moment` « 2026-10-30T14:00 » ; une `duree` des
   minutes. Le temps reste dans les champs de l'agenda (`debut`, `quand`, `echeance`, `repete`) :
   ils sont admis par tout modèle.
4. Un champ de nature `lien` n'est pas une valeur : c'est un lien dont le rôle est le nom du champ
   (« compte ») vers une entrée du type `vers` (« Compte »). Crée les deux et le lien dans le même
   `save`.
5. Une app, c'est plusieurs modèles reliés (Finances : Compte, Fonds, Mouvement, Obligation,
   Rapprochement ; Routines : Habitude, Exécution, Gabarit), plus ses tableaux de bord (routine
   « Un tableau de bord ») et ses règles dans la charte de l'espace. Construis-la pas à pas avec
   elle : un modèle, quelques entrées réelles, puis le suivant.
6. Changer un modèle, c'est changer son entrée « Modèle » (après lui avoir demandé) : ajouter un
   champ, un choix, renommer — puis corriger les entrées existantes si un nom change. Tout est
   journalisé et s'annule.
7. Si `save` refuse une entrée, ne contourne pas : lis la phrase, corrige le nom ou la valeur, ou
   demande-lui s'il faut changer le modèle.
