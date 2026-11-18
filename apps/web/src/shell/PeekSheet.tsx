import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Maximize2 } from 'lucide-react';
import { EntryView } from '../routes/Entry';
import { Sheet } from '../ui';

// The fiche in a side card (v3 D10, F2): opened from any list (`?fiche=…`), the page stays under
// it; closing it, or « back », returns to the list. « Pleine page » opens its own page.

export function PeekSheet() {
  const search = useSearch({ strict: false }) as { fiche?: string };
  const navigate = useNavigate();
  const id = search.fiche;
  const close = () =>
    void navigate({
      to: '.',
      search: ((was: Record<string, unknown>) => {
        const next = { ...was };
        delete next.fiche;
        return next;
      }) as never,
    });
  return (
    <Sheet
      open={!!id}
      onOpenChange={(open) => !open && close()}
      title="Fiche"
      wide
      action={
        id ? (
          <Link
            to="/entree/$id"
            params={{ id }}
            className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-rule bg-paper px-2.5 text-[13px] font-semibold hover:border-rule-strong"
          >
            <Maximize2 size={14} />
            Pleine page
          </Link>
        ) : null
      }
    >
      {id && (
        <div className="grid gap-4 p-4">
          <EntryView key={id} id={id} embedded />
        </div>
      )}
    </Sheet>
  );
}
