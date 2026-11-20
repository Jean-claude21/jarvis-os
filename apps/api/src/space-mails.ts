import { personEmail } from '@jarvis-os/core';
import type pg from 'pg';
import { fill, wordsOf, type Lang } from './i18n';
import { mailOf, sendQuietly, type Mailer } from './mail';
import { namesOf } from './spaces';

// The mails of shared spaces (v3 mails), from any door — the app, an assistant through MCP: the
// invited person gets her invitation; the owners learn who joined. A mail that cannot leave never
// stops the gesture: the link is also given back, to be passed by hand.

interface MailDeps {
  db: pg.Pool;
  mailer: Mailer | null;
  publicUrl: string;
}

/** The invitation by e-mail: who invites, into which space, until when. True when it left. */
export async function mailInvitation(
  deps: MailDeps,
  input: {
    lang: Lang;
    /** Who invites: her account. */
    person: string;
    space: string;
    email: string;
    link: string;
    expiresAt: string;
  },
): Promise<boolean> {
  const words = wordsOf(input.lang);
  const who =
    (await namesOf(deps.db, [input.person])).get(input.person) ??
    (await personEmail(deps.db, input.person)) ??
    'Jarvis';
  const values = { who, space: input.space, email: input.email };
  return sendQuietly(
    deps.mailer,
    {
      to: input.email,
      ...mailOf({
        subject: fill(words.mailInviteSubject, values),
        title: fill(words.mailInviteTitle, values),
        lines: [fill(words.mailInviteLead, values)],
        button: { label: words.mailInviteButton, url: input.link },
        after: fill(words.mailInviteAfter, {
          ...values,
          until: new Date(input.expiresAt).toLocaleDateString(
            input.lang === 'fr' ? 'fr-FR' : 'en-GB',
          ),
        }),
        footer: words.mailFooter,
      }),
    },
    'invitation',
  );
}

/** The owners of a space learn who joined it; how many were told. */
export async function mailJoined(
  deps: MailDeps,
  input: {
    lang: Lang;
    /** Who joined: her account and address. */
    person: string;
    email: string;
    space: string;
    owners: string[];
  },
): Promise<number> {
  const words = wordsOf(input.lang);
  const who = (await namesOf(deps.db, [input.person])).get(input.person) ?? input.email;
  const values = { who, space: input.space, email: input.email };
  let told = 0;
  for (const owner of input.owners) {
    if (owner === input.person) continue;
    const to = await personEmail(deps.db, owner);
    if (!to) continue;
    const sent = await sendQuietly(
      deps.mailer,
      {
        to,
        ...mailOf({
          subject: fill(words.mailJoinedSubject, values),
          title: fill(words.mailJoinedTitle, values),
          lines: [fill(words.mailJoinedLead, values)],
          button: {
            label: words.mailJoinedButton,
            url: `${deps.publicUrl.replace(/\/$/, '')}/v3/reglages?t=espaces`,
          },
          footer: words.mailFooter,
        }),
      },
      'member joined',
    );
    if (sent) told += 1;
  }
  return told;
}
