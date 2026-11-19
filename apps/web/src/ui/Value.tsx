import { ExternalLink } from 'lucide-react';
import { showValue, siteOf } from '../engine/format';
import type { Field } from '../engine/types';

// A value as she reads it, everywhere a value is shown (tables, page tables, the fiche): a web
// address is a link she opens in one click, named by its site (« drive.google.com »), never a long
// line to copy. Everything else reads as `showValue` says.

const WEB = /^https?:\/\/\S+$/i;

export function WebAddress({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={href}
      // Inside a row that opens the fiche, the link opens the address and nothing else.
      onClick={(event) => event.stopPropagation()}
      className={
        'relative z-[1] inline-flex max-w-full items-center gap-1 text-primary hover:underline ' +
        (className ?? '')
      }
    >
      <span className="truncate">{siteOf(href)}</span>
      <ExternalLink size={12} className="flex-none" />
    </a>
  );
}

/** A value: a link when it is a web address, else its words (« — » when empty, if asked). */
export function Value({
  value,
  field,
  empty = '',
}: {
  value: unknown;
  field?: Field | undefined;
  empty?: string;
}) {
  if (typeof value === 'string' && WEB.test(value.trim()))
    return <WebAddress href={value.trim()} />;
  if (
    Array.isArray(value) &&
    value.length &&
    value.every((one) => typeof one === 'string' && WEB.test(one))
  )
    return (
      <span className="inline-flex flex-wrap gap-x-3">
        {(value as string[]).map((one) => (
          <WebAddress key={one} href={one} />
        ))}
      </span>
    );
  return <>{showValue(value, field) || empty}</>;
}
