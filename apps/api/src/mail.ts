import nodemailer from 'nodemailer';

// Her e-mails (spec 020, v3 mails): one mailer for every message Jarvis sends by e-mail — her
// reminders and briefs (the outbox), and the mails that are not hers to choose: a forgotten
// password, an invitation into a space, someone who joined hers. Any SMTP server
// (`JARVIS_SMTP_URL`), or Resend by its key (`RESEND_API_KEY`, through Resend's SMTP); the sender is
// `JARVIS_EMAIL_FROM`, an address of a domain the provider has verified.

/** Sends an e-mail; throws with the server's reason when it refuses. */
export interface Mailer {
  send(mail: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

/** E-mail through SMTP; null when it is not configured. */
export function smtpMailer(url: string | undefined, from: string | undefined): Mailer | null {
  if (!url || !from) return null;
  const transport = nodemailer.createTransport(url);
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}

/** The mailer this server's environment gives: its SMTP server, else Resend, else none. */
export function mailerFromEnv(env: NodeJS.ProcessEnv = process.env): Mailer | null {
  const from = env.JARVIS_EMAIL_FROM;
  if (env.JARVIS_SMTP_URL) return smtpMailer(env.JARVIS_SMTP_URL, from);
  if (env.RESEND_API_KEY)
    return smtpMailer(
      `smtps://resend:${encodeURIComponent(env.RESEND_API_KEY)}@smtp.resend.com:465`,
      from,
    );
  return null;
}

/**
 * Sends, and never fails the gesture that asked for it: a mail not sent is logged (without its
 * address), and the gesture goes on. False when nothing was sent.
 */
export async function sendQuietly(
  mailer: Mailer | null,
  mail: Parameters<Mailer['send']>[0],
  what: string,
): Promise<boolean> {
  if (!mailer) {
    console.warn(`[mail] ${what}: no mailer configured (JARVIS_SMTP_URL or RESEND_API_KEY)`);
    return false;
  }
  try {
    await mailer.send(mail);
    return true;
  } catch (error) {
    console.warn(`[mail] ${what}: ${(error as Error).message}`);
    return false;
  }
}

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** One layout for every mail: a title, a few lines, one button, a footer — and the same as text. */
export function mailOf(input: {
  subject: string;
  title: string;
  lines: string[];
  button?: { label: string; url: string };
  after?: string;
  footer: string;
}): { subject: string; text: string; html: string } {
  const text = [
    input.title,
    ...input.lines,
    input.button ? `${input.button.label} : ${input.button.url}` : '',
    input.after ?? '',
    input.footer,
  ]
    .filter(Boolean)
    .join('\n\n');
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#2a1610;max-width:560px">
<div style="width:32px;height:32px;line-height:32px;text-align:center;background:#b83a1b;color:#fffdf9;font-weight:700;border-radius:2px;margin-bottom:16px">J</div>
<h2 style="margin:0 0 12px;font-size:20px">${escape(input.title)}</h2>
${input.lines.map((line) => `<p style="margin:0 0 12px">${escape(line)}</p>`).join('\n')}
${input.button ? `<p style="margin:18px 0"><a href="${escape(input.button.url)}" style="display:inline-block;padding:11px 18px;background:#2a1610;color:#fffdf9;border-radius:2px;text-decoration:none;font-weight:600">${escape(input.button.label)}</a></p><p style="margin:0 0 12px;color:#6b4e43;font-size:13px;word-break:break-all">${escape(input.button.url)}</p>` : ''}
${input.after ? `<p style="margin:0 0 12px;color:#6b4e43">${escape(input.after)}</p>` : ''}
<p style="color:#9a8276;font-size:12px;margin-top:22px">${escape(input.footer)}</p></div>`;
  return { subject: input.subject, text, html };
}
