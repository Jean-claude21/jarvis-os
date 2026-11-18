import { Link } from '@tanstack/react-router';
import { peek } from '../peek';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useUpload } from '../../lib/upload';
import { GENRE_WORDS } from '../../lib/words';
import { useKindName } from '../../lib/kinds';
import { Button, Empty, Segmented, Tag, ago, cn } from '../../ui';
import type { FileRow } from '../sources';
import { FILE_GENRES, fileGenreOf } from '../../ui/more';
import { FileThumb, isPhoto } from '../../routes/FileParts';
import type { ViewSearch, ViewChange } from '../types';

// Les fichiers (gr8r's Files): search, kind of file, newest or by name, a grid or a list; each its
// coloured icon, size, day and the entries it belongs to; a drop zone and « Déposer » to add one.

const GENRES = FILE_GENRES.map((one) => ({
  ...one,
  test: (f: FileRow) => one.test(f.mediaType, f.name),
}));
const genreOf = (file: FileRow) => fileGenreOf(file.mediaType, file.name);
const size = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;

export function FilesRender({
  files,
  state,
  set,
}: {
  files: FileRow[];
  state: ViewSearch;
  set: (change: ViewChange) => void;
}) {
  const kindName = useKindName();
  const input = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [hover, setHover] = useState(false);
  const genre = state.f?.startsWith('genre=') ? state.f.slice(6) : 'all';
  const words = (state.q ?? '').toLowerCase();
  const shown = files
    .filter((one) => genre === 'all' || genreOf(one).key === genre)
    .filter((one) => !words || `${one.title} ${one.name}`.toLowerCase().includes(words))
    .sort((a, b) =>
      state.sort === 'title'
        ? a.title.localeCompare(b.title, 'fr') * (state.desc ? -1 : 1)
        : b.createdAt.localeCompare(a.createdAt) * (state.desc ? -1 : 1),
    );
  const { send, busy } = useUpload();
  const upload = (list: FileList | null) => void send([...(list ?? [])]);
  const present = GENRES.filter((one) => files.some((file) => one.test(file)));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-sand px-3 py-2">
        <Segmented
          label="Genre"
          value={genre}
          onChange={(value) => set({ f: value === 'all' ? undefined : `genre=${value}` })}
          options={[
            { value: 'all', label: 'Tous', n: files.length },
            ...present.map((one) => ({ value: one.key, label: one.label })),
          ]}
        />
        <Segmented
          label="Ordre"
          value={state.sort === 'title' ? 'title' : 'new'}
          onChange={(value) =>
            set({ sort: value === 'title' ? 'title' : undefined, desc: undefined })
          }
          options={[
            { value: 'new', label: 'Récents' },
            { value: 'title', label: 'Nom' },
          ]}
        />
        <span className="ml-auto flex gap-2">
          <Segmented
            label="Disposition"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'list', label: 'Liste' },
              { value: 'grid', label: 'Grille' },
            ]}
          />
          <Button size="sm" tone="solid" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={14} />
            Déposer
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(event) => upload(event.target.files)}
          />
        </span>
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setHover(false);
          upload(event.dataTransfer.files);
        }}
        className={cn(
          'm-3 grid place-items-center rounded-[10px] border border-dashed border-rule-strong px-4 py-4 text-center text-[13px] text-bark',
          hover && 'border-primary bg-sand',
        )}
      >
        {busy ? 'Dépôt en cours…' : 'Glisse des fichiers ici, ou utilise « Déposer ».'}
      </div>
      {!shown.length ? (
        <Empty
          title="Aucun fichier"
          lead="Les fichiers déposés, envoyés par Telegram ou liés à tes entrées apparaissent ici."
        />
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3 px-3 pb-3">
          {shown.map((file) => {
            const one = genreOf(file);
            return (
              <Link
                key={file.entryId}
                to="."
                search={peek(file.entryId)}
                className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-rule bg-paper p-3 hover:border-rule-strong"
              >
                {isPhoto(file.mediaType) ? (
                  <FileThumb
                    id={file.entryId}
                    mediaType={file.mediaType}
                    name={file.name}
                    size={0}
                    className="!h-32 !w-full"
                  />
                ) : (
                  <FileThumb id={file.entryId} mediaType={file.mediaType} name={file.name} />
                )}
                <b className="truncate text-[13.5px]">{file.title || file.name}</b>
                <span className="text-xs text-bark">
                  {one.label} · {size(file.size)} · {ago(file.createdAt)}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead>
              <tr className="border-y border-rule bg-sand/60 text-left font-mono text-[11px] tracking-[0.04em] text-bark uppercase">
                <th className="px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Genre</th>
                <th className="px-3 py-2 text-right font-medium">Taille</th>
                <th className="px-3 py-2 font-medium">Lié à</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((file) => {
                const one = genreOf(file);
                return (
                  <tr
                    key={file.entryId}
                    className="border-b border-rule last:border-0 hover:bg-sand"
                  >
                    <td className="max-w-[320px] px-3 py-2">
                      <Link
                        to="."
                        search={peek(file.entryId)}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <FileThumb
                          id={file.entryId}
                          mediaType={file.mediaType}
                          name={file.name}
                          size={32}
                        />
                        <span className="truncate font-semibold">{file.title || file.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-bark">
                      {file.genre && GENRE_WORDS[file.genre] ? (
                        <Tag tone="info" dot={false}>
                          {GENRE_WORDS[file.genre]}
                        </Tag>
                      ) : file.readState === 'pending' ? (
                        <span className="text-faint">lecture…</span>
                      ) : (
                        one.label
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-bark">{size(file.size)}</td>
                    <td className="max-w-[220px] px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {file.links.slice(0, 2).map((link) => (
                          <Link
                            key={link.id}
                            to="."
                            search={peek(link.id)}
                            title={kindName(link.kind)}
                          >
                            <Tag tone="neutral" dot={false}>
                              {link.title}
                            </Tag>
                          </Link>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-bark">{ago(file.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
