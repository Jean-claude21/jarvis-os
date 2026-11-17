---
name: Les bilans
when: elle demande un bilan (de la semaine, du mois, d'un projet, de ses finances, d'une période qu'elle donne), ou un « Bilan » attend d'être rédigé
---

# Les bilans

Un bilan est une entrée de kind « Bilan » : `type` (hebdo, mensuel, projet, finances… ou le nom du
skill qui le produit), `from` et `to` (les jours de la période, « 2026-11-03 »), `status`
(`to_write`, puis `written`) et `text` (le bilan lui-même, en Markdown).

1. **Le trouver ou le créer.** `query` : les « Bilan » dont `status` vaut `to_write` — elle en a
   peut-être préparé un depuis la page Bilans. Sinon, crée-le avec le type et la période qu'elle
   dit (« du 1er au 15 novembre », « le mois dernier »), `status: 'to_write'`.
2. **Le skill.** S'il existe une routine de ses espaces dont `result.kind` vaut « Bilan » et dont le
   nom ou le type correspond, suis-la (`routine`) : ses étapes, ses critères, son style. Sinon,
   fais un bilan simple : ce qui a eu lieu, ce qui a avancé, ce qui a glissé, les chiffres, trois
   actions.
3. **Les faits, sur la période seulement.** `query` sur `from`…`to` : son agenda, ses entrées
   créées ou changées, ses dépenses (`Répondre avec des chiffres`), ses habitudes tenues, ses notes.
   N'invente rien ; un chiffre vient d'une requête.
4. **L'écrire en Markdown riche**, lisible dans le lecteur de Jarvis :
   - des titres (`##`) — ils font le sommaire ;
   - des tableaux pour les chiffres ;
   - des encadrés : `> [!IMPORTANT] À retenir`, `> [!TIP]`, `> [!WARNING]` ;
   - des schémas Mermaid quand ils aident : ` ```mermaid ` (`pie` pour une répartition,
     `timeline` pour la période, `flowchart` pour un enchaînement, `xychart-beta` pour une évolution) ;
   - des cases `- [ ]` pour les actions.
5. **L'enregistrer** : `save` sur l'entrée, `text` = le bilan, `status: 'written'`. Dis-lui qu'il
   est prêt dans **Bilans**, en deux phrases : ce qui ressort, et la première action.
