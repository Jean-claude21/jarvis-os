import { Bold, Heading2, Italic, Link2, List, ListChecks } from 'lucide-react';
import { useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { Button, Segmented, cn } from './index';

// Writing a text on screen (v3 D17, « écrire un document »): her words in Markdown — the way every
// text is kept and read in Jarvis — with a bar for what one writes most (a title, bold, a list, a
// box to tick, a link) and the page as it will read, beside it on a wide screen, a tab away on a
// phone. Nothing is lost: Entrée is a new line; « Garder » keeps it.

type Wrap = { before: string; after?: string; line?: boolean; placeholder: string };
const TOOLS: { label: string; icon: typeof Bold; wrap: Wrap }[] = [
  { label: 'Titre', icon: Heading2, wrap: { before: '## ', line: true, placeholder: 'Titre' } },
  { label: 'Gras', icon: Bold, wrap: { before: '**', after: '**', placeholder: 'texte' } },
  { label: 'Italique', icon: Italic, wrap: { before: '_', after: '_', placeholder: 'texte' } },
  { label: 'Liste', icon: List, wrap: { before: '- ', line: true, placeholder: 'élément' } },
  {
    label: 'Case à cocher',
    icon: ListChecks,
    wrap: { before: '- [ ] ', line: true, placeholder: 'à faire' },
  },
  { label: 'Lien', icon: Link2, wrap: { before: '[', after: '](https://)', placeholder: 'lien' } },
];

export function TextEditor({
  value,
  onSave,
  onCancel,
  saving = false,
}: {
  value: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [text, setText] = useState(value);
  const [tab, setTab] = useState<'write' | 'read'>('write');
  const area = useRef<HTMLTextAreaElement>(null);
  const apply = ({ before, after = '', line, placeholder }: Wrap) => {
    const box = area.current;
    if (!box) return;
    const { selectionStart: start, selectionEnd: end } = box;
    const chosen = text.slice(start, end) || placeholder;
    // A line's mark goes at the start of the line.
    const at = line ? text.lastIndexOf('\n', start - 1) + 1 : start;
    const next = line
      ? `${text.slice(0, at)}${before}${text.slice(at, end) || placeholder}${text.slice(end)}`
      : `${text.slice(0, start)}${before}${chosen}${after}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      box.focus();
      const from = (line ? at : start) + before.length;
      box.setSelectionRange(
        from,
        from + (line ? (text.slice(at, end) || placeholder).length : chosen.length),
      );
    });
  };
  const changed = text !== value;
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map(({ label, icon: Icon, wrap }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => apply(wrap)}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[2px] border border-rule text-bark hover:bg-sand hover:text-ink"
          >
            <Icon size={15} />
          </button>
        ))}
        <span className="ml-auto lg:hidden">
          <Segmented
            label="Écrire ou lire"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'write', label: 'Écrire' },
              { value: 'read', label: 'Aperçu' },
            ]}
          />
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          ref={area}
          aria-label="Le texte"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSave(text);
            if (event.key === 'Escape') onCancel();
          }}
          className={cn(
            'min-h-[50vh] w-full resize-y rounded-[2px] border border-rule bg-paper p-3 font-mono text-[13.5px] leading-relaxed outline-none focus:border-primary',
            tab === 'read' && 'hidden lg:block',
          )}
          placeholder="Écris ici. # pour un titre, - pour une liste, - [ ] pour une case à cocher."
        />
        <div
          aria-label="Aperçu"
          className={cn(
            'min-h-[50vh] overflow-auto rounded-[2px] border border-rule bg-sand/30',
            tab === 'write' && 'hidden lg:block',
          )}
        >
          {text.trim() ? (
            <Markdown text={text} className="px-4 py-3" />
          ) : (
            <p className="px-4 py-3 text-[13px] text-faint">L’aperçu de ton texte s’affiche ici.</p>
          )}
        </div>
      </div>
      <span className="flex flex-wrap items-center gap-2">
        <Button tone="solid" disabled={!changed || saving} onClick={() => onSave(text)}>
          Garder
        </Button>
        <Button onClick={onCancel}>Annuler</Button>
        <span className="text-xs text-faint">Ctrl + Entrée garde · Échap annule</span>
      </span>
    </div>
  );
}
