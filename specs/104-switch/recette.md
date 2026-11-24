# 104 — La recette de la v3 (à jouer sur next, avec tes vraies données)

Ce que les tests automatiques ne peuvent pas dire : que la v3 fait ce que tu attends, avec ta vie
dedans. Chaque ligne se coche à l'écran, sur next.jarvis.kete.digital. Ce qui ne va pas se note à
côté ; on corrige, puis on rejoue la ligne.

Ce que les tests vérifient déjà, à chaque envoi sur `next` : le cœur (Vitest), l'API (Vitest), et
chaque écran et chaque geste dans un vrai navigateur, aux trois largeurs (`apps/e2e`, Playwright).

## 0. Avant de commencer

- [ ] next redéployé depuis la branche `next`, migrations 0034 à 0043 appliquées.
- [ ] `RESEND_API_KEY` et `JARVIS_EMAIL_FROM` posés sur next (sinon les mails ne partent pas).
- [ ] Le quota Neon du projet de production est rétabli (sinon next et la production restent
      hors ligne).

## 1. Aujourd'hui et la file

- [ ] Aujourd'hui dit bonjour, la date, et ce qui t'attend ; « Pour commencer » se coche seul.
- [ ] « Chercher ou noter » : une note gardée arrive dans « À valider ».
- [ ] « /une-phrase » lance son automatisme (sur l'écran et sur Telegram, qui dit quel agent).
- [ ] « combien en … ce mois ? » répond un chiffre juste.
- [ ] Une facture déposée devient une proposition ; « Modifier » change le montant avant le oui.
- [ ] Les valeurs lues d'un fichier attendent « C'est juste » ; « Corriger » ouvre la fiche.
- [ ] Dans une app, « À valider » ne montre que ce qui la concerne.

## 2. Tes apps et tes données

- [ ] Chaque app s'ouvre : Aperçu, Son rôle, ses pages, ses données, son activité.
- [ ] Une vue en tableau : cocher des lignes, les mettre de côté, l'Activité les rend.
- [ ] Renommer un type ; « Ses champs » : renommer, ajouter, retirer — les valeurs restent.
- [ ] « Partager par un lien » : le formulaire s'ouvre chez quelqu'un d'autre ; ce qu'il envoie
      arrive dans « À valider ».
- [ ] « Suivre quelque chose » : une phrase devient une collection dans une app.
- [ ] Une longue liste (Candidatures) défile sans lenteur.
- [ ] Désinstaller une app d'essai : ses entrées restent, l'Activité l'annule.
- [ ] Essayer une app du catalogue : l'exemple ressemble à ce qu'elle fera.

## 3. Agenda, documents, objectifs, bilans

- [ ] L'agenda montre tes rendez-vous et répétitions ; « Dans mon téléphone » s'abonne.
- [ ] « Nouveau document » : écrire, voir l'aperçu, garder ; le texte se relit comme une page.
- [ ] Un lien Drive s'ouvre d'un clic.
- [ ] Objectifs : où tu en es, et tes habitudes sur 28 jours.
- [ ] « Nouveau bilan » propose tes skills de bilan seulement.

## 3 bis. Les cartes (spec 107)

- [ ] Sur une page d'app, « Modifier » : ajouter une carte, la déplacer, l'élargir, en retirer
      une, « Enregistrer » ; recharger : la page est comme laissée. « Annuler » ne change rien.
- [ ] Aujourd'hui › « Mes cartes » : depuis rien, une carte ajoutée reste là chaque jour.
- [ ] Une fiche (un compte, un abonnement) › « Ses cartes » : les entrées liées à elle seule.
- [ ] Construire › Composants › « Cartes de tes apps » : « Voir », puis « Ajouter à… ».
- [ ] Menu › « Tableaux de bord » : tous listés (les miens, puis ceux de mes apps) ; un clic ouvre,
      « Tous les tableaux » revient ; « Supprimer » après confirmation, l'Activité le rend.
- [ ] « Ma vue d'ensemble » en un geste ; « Nouveau tableau de bord », nommé, rempli, gardé.
- [ ] « Ajouter une carte » › « Créer une carte » : un chiffre de tes types, nommé ; il revient
      ensuite parmi tes cartes.
- [ ] Connexion : « Continuer avec Google » crée le compte ou connecte ; relier Claude marche aussi
      avec un compte Google.

## 4. Ceux qui travaillent pour toi

- [ ] Construire : chaque agent et ses automatismes ; ceux « par défaut » sont les bons.
- [ ] « Lire les offres » et « Offres du matin » sont chez le Chasseur d'offres (4 appels/jour).
- [ ] Mettre l'Assistant du matin en pause : plus de brief ; le reprendre : il revient.
- [ ] L'heure du brief se règle dans Réglages ; « Me l'envoyer maintenant » arrive.
- [ ] La mémoire d'un agent garde une note ; « Activité et Telegram » envoie un compte rendu.
- [ ] Skills : chacun dit quand il démarre ; « Structurer » propose les cinq morceaux.

## 5. Réglages, espaces, mails

- [ ] Mot de passe oublié : le mail arrive, le lien marche une fois, l'ancien ne marche plus.
- [ ] Inviter quelqu'un dans un espace : il reçoit le mail ; quand il rejoint, tu reçois un mail.
- [ ] Le bouton d'un mail, ouvert sans être connecté : après la connexion, tu arrives sur la page
      du lien (pas sur Aujourd'hui).
- [ ] « Ce qu'il voit » : ouvrir un seul type à un membre — il ne voit que lui (et ses notes).
- [ ] Un assistant relié : « Ses espaces » change ce qu'il atteint.
- [ ] Un serveur d'outils se relie depuis le catalogue.
- [ ] Ce que Jarvis t'a envoyé, et les sauvegardes, sont là.
- [ ] Importer un dossier de notes : les notes arrivent ; le réimporter ne double rien.

## 6. Sur ton téléphone

- [ ] Les écrans ci-dessus, à la largeur du téléphone : rien ne déborde, tout se touche.

Une fois tout coché : la v3 est validée. La bascule (V9, `parity.md`) peut se décider.
