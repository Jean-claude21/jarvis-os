// The words of Jarvis's pages, in French and English: no visible string is hard-coded elsewhere.

const words = {
  fr: {
    signInTitle: 'Connexion à Jarvis',
    signInLead: 'Connecte-toi pour relier {client} à ta vie Jarvis.',
    signInLeadPlain: 'Connecte-toi à ta vie Jarvis.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    name: 'Ton prénom',
    signIn: 'Se connecter',
    signUp: 'Créer mon compte',
    noAccount: 'Pas encore de compte ?',
    haveAccount: 'Déjà un compte ?',
    wrong: 'E-mail ou mot de passe incorrect.',
    failed: 'Ça n’a pas marché : {reason}',
    consentTitle: 'Autoriser {client} ?',
    consentLead:
      '{client} demande l’accès à ta vie Jarvis : lire, ranger, calculer et annuler pour toi.',
    consentScopes: 'Ce qui est demandé : {scopes}',
    consentNote:
      'Tu pourras retirer cet accès à tout moment. Jarvis ne paie, n’envoie ni n’efface rien sans ton oui.',
    accept: 'Autoriser',
    refuse: 'Refuser',
    expired: 'Cette demande a expiré ou n’est pas valide. Recommence depuis ton application.',
    aClient: 'Une application',
    consentSpaces: 'Les espaces qu’il pourra atteindre',
    consentOwn: '{space} (ton espace à toi)',
    consentNone: 'Choisis au moins un espace.',
    inviteTitle: 'Une invitation dans Jarvis',
    inviteLead: 'Tu es invité·e à rejoindre l’espace partagé « {space} » ({email}).',
    inviteSignIn: 'Connecte-toi, ou crée ton compte, avec cette adresse.',
    inviteAccept: 'Rejoindre l’espace',
    inviteJoined:
      'Tu fais maintenant partie de « {space} ». Ton espace à toi reste privé. Tu peux fermer cette page.',
    inviteUsed: 'Cette invitation a déjà servi.',
    inviteExpired: 'Cette invitation a expiré : demande-en une nouvelle.',
    inviteWithdrawn: 'Cette invitation a été retirée.',
    inviteMissing: 'Ce lien d’invitation n’est pas valide.',
  },
  en: {
    signInTitle: 'Sign in to Jarvis',
    signInLead: 'Sign in to connect {client} to your Jarvis life.',
    signInLeadPlain: 'Sign in to your Jarvis life.',
    email: 'E-mail address',
    password: 'Password',
    name: 'Your first name',
    signIn: 'Sign in',
    signUp: 'Create my account',
    noAccount: 'No account yet?',
    haveAccount: 'Already have an account?',
    wrong: 'Wrong e-mail or password.',
    failed: 'That did not work: {reason}',
    consentTitle: 'Allow {client}?',
    consentLead: '{client} asks to reach your Jarvis life: read, file, compute and undo for you.',
    consentScopes: 'What is asked: {scopes}',
    consentNote:
      'You can take this access back at any time. Jarvis pays, sends or erases nothing without your yes.',
    accept: 'Allow',
    refuse: 'Refuse',
    expired: 'This request has expired or is not valid. Start again from your application.',
    aClient: 'An application',
    consentSpaces: 'The spaces it will reach',
    consentOwn: '{space} (your own space)',
    consentNone: 'Choose at least one space.',
    inviteTitle: 'An invitation to Jarvis',
    inviteLead: 'You are invited to join the shared space « {space} » ({email}).',
    inviteSignIn: 'Sign in, or create your account, with this address.',
    inviteAccept: 'Join the space',
    inviteJoined:
      'You are now part of « {space} ». Your own space stays private. You can close this page.',
    inviteUsed: 'This invitation was already used.',
    inviteExpired: 'This invitation has expired: ask for a new one.',
    inviteWithdrawn: 'This invitation was withdrawn.',
    inviteMissing: 'This invitation link is not valid.',
  },
} as const;

export type Lang = keyof typeof words;
export type Words = (typeof words)[Lang];

/** French unless the browser prefers English. */
export function langOf(acceptLanguage: string | undefined): Lang {
  const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'fr';
}

export const wordsOf = (lang: Lang): Words => words[lang];

/** « {client} » filled in. */
export const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
