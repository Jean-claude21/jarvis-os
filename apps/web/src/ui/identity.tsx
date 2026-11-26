import { Globe, Mail, Phone } from 'lucide-react';
import { useState } from 'react';
import { Avatar, cn, colorOf, initialsOf } from './index';

// Who someone is, at a glance (v3 D5, the « who » facet): a person's round avatar — with the logo
// of where they work when their address says it — an organisation's real logo, and the gestures
// that reach them (write, call, open their site), each a real link.

export interface Who {
  kind: 'person' | 'organization';
  email?: string | null;
  phone?: string | null;
  domain?: string | null;
}

const PERSONAL =
  /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|orange|free|sfr|laposte|wanadoo|proton|protonmail|aol|gmx)\./i;

/** A clean domain from a website or an address: « https://www.darty.com/x » → « darty.com ». */
export function cleanDomain(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#\s]/)[0]!;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

/** Where a logo comes from: the site, else a work address (never a personal mailbox). */
export function logoDomain(who?: Who | null): string | null {
  if (!who) return null;
  const site = cleanDomain(who.domain);
  if (site) return site;
  const mail = typeof who.email === 'string' ? /@([^\s>]+)$/.exec(who.email.trim())?.[1] : null;
  const domain = cleanDomain(mail);
  return domain && !PERSONAL.test(domain) ? domain : null;
}

/** A company's logo, fetched by Jarvis; its initial on its colour when it has none. */
/** A service's mark as the API sends it (simple-icons, inside the page: nothing fetched). */
export interface BrandMark {
  path: string | null;
  hex: string;
  fg: string;
  initial: string;
}

/** A service's logo: its glyph in its colour on a white tile, or its initial on its colour. */
export function BrandLogo({
  mark,
  name,
  size = 36,
}: {
  mark?: BrandMark | null | undefined;
  name: string;
  size?: number;
}) {
  const radius = Math.max(6, Math.round(size / 4.5));
  if (!mark?.path)
    return (
      <span
        className="grid flex-none place-items-center font-display font-bold"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: mark ? `#${mark.hex}` : colorOf(name),
          color: mark?.fg ?? '#fffdf9',
          fontSize: Math.max(11, size * 0.42),
        }}
        aria-hidden
      >
        {(mark?.initial ?? initialsOf(name)).slice(0, 1)}
      </span>
    );
  return (
    <span
      className="grid flex-none place-items-center border border-rule bg-[#fff]"
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill={`#${mark.hex}`}>
        <path d={mark.path} />
      </svg>
    </span>
  );
}

export function Logo({
  name,
  domain,
  size = 32,
}: {
  name: string;
  domain: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const radius = Math.max(4, Math.round(size / 5));
  if (!domain || failed)
    return (
      <span
        className="grid flex-none place-items-center font-display font-bold text-[#fffdf9]"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: colorOf(name),
          fontSize: Math.max(10, size * 0.42),
        }}
        aria-hidden
      >
        {initialsOf(name).slice(0, 1)}
      </span>
    );
  return (
    <span
      className="grid flex-none place-items-center overflow-hidden border border-rule bg-[#fff]"
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden
    >
      <img
        src={`/api/logo/${encodeURIComponent(domain)}`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-[78%] w-[78%] object-contain"
      />
    </span>
  );
}

/** A person (avatar, and their workplace's logo in the corner) or an organisation (its logo). */
export function Identity({
  name,
  who,
  size = 32,
}: {
  name: string;
  who?: Who | null;
  size?: number;
}) {
  const domain = logoDomain(who);
  if (who?.kind === 'organization') return <Logo name={name} domain={domain} size={size} />;
  return (
    <span className="relative inline-block flex-none" style={{ width: size, height: size }}>
      <Avatar name={name} size={size} />
      {domain && size >= 28 && (
        <span className="absolute -right-1.5 -bottom-1.5 rounded-[5px] bg-paper p-[1px]">
          <Logo name={domain} domain={domain} size={Math.round(size * 0.42)} />
        </span>
      )}
    </span>
  );
}

const linkClass =
  'grid h-8 w-8 flex-none place-items-center rounded-[2px] border border-rule bg-paper text-bark hover:border-rule-strong hover:text-ink';

/** The gestures that reach them: write, call, open the site — real links. */
export function WhoActions({ who, className }: { who?: Who | null; className?: string }) {
  if (!who) return null;
  const email = typeof who.email === 'string' && who.email.includes('@') ? who.email.trim() : null;
  const phone = typeof who.phone === 'string' && /\d/.test(who.phone) ? who.phone.trim() : null;
  const site = cleanDomain(who.domain);
  if (!email && !phone && !site) return null;
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <span className={cn('flex flex-none gap-1.5', className)}>
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={stop}
          className={linkClass}
          title={`Écrire à ${email}`}
          aria-label="Écrire"
        >
          <Mail size={15} />
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
          onClick={stop}
          className={linkClass}
          title={`Appeler ${phone}`}
          aria-label="Appeler"
        >
          <Phone size={15} />
        </a>
      )}
      {site && (
        <a
          href={`https://${site}`}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className={linkClass}
          title={site}
          aria-label="Ouvrir le site"
        >
          <Globe size={15} />
        </a>
      )}
    </span>
  );
}
