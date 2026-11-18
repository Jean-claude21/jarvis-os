import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  CloudDownload,
  CloudUpload,
  History,
  Link2,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { api, spaceNow } from '../lib/api';
import { sendFile } from '../lib/send';
import { useFiles, type FileRow } from '../engine/sources';
import { peek } from '../engine/peek';
import { Button, Panel, ago, cn, rowClass } from '../ui';
import { FileIcon, toast, useConfirm } from '../ui/more';
import { EntryPicker, useEntryChange, type EditableField } from './EntryParts';

// Les médias à l'écran (v3 médias): a file seen by its thumbnail when it is a photo, by its icon
// otherwise — in a file field, on a card, in the files' grid. On its fiche: a new version, its
// earlier versions, a link to share it for a day, sending it to Drive, and erasing it for good
// (only after she says yes). Her Google Drive in Documents, to bring a file in.

/** A stored file's address (its bytes, its thumbnail, a version), in the space she is in. */
export function fileHref(id: string, extra: Record<string, string> = {}, path = '') {
  const url = new URL(`/api/files/${id}${path}`, location.origin);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  if (spaceNow()) url.searchParams.set('space', spaceNow()!);
  return url.pathname + url.search;
}

export const isPhoto = (mediaType: string) =>
  /^image\/(jpe?g|png|webp|gif|heic|heif|avif|tiff)/.test(mediaType);
const size = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;

/** A file at a glance: its thumbnail (a photo), else its coloured icon. */
export function FileThumb({
  id,
  mediaType,
  name,
  size: side = 36,
  className,
}: {
  id: string;
  mediaType: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!isPhoto(mediaType) || failed)
    return <FileIcon mediaType={mediaType} name={name} size={side} />;
  return (
    <img
      src={fileHref(id, { thumb: '1' })}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      width={side}
      height={side}
      className={cn('flex-none rounded-[8px] bg-sand object-cover', className)}
      style={{ width: side, height: side }}
    />
  );
}

/** A file field's ids, one or many. */
export const fileIds = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(
    (one): one is string => typeof one === 'string' && one.length > 0,
  );

/** A cover for a card: the first photo among its file fields. */
export function coverOf(
  values: Record<string, unknown>,
  fields: { path: string; type: string }[],
  files: FileRow[],
) {
  for (const field of fields) {
    if (field.type !== 'file') continue;
    for (const id of fileIds(values[field.path])) {
      const file = files.find((one) => one.entryId === id);
      if (file && isPhoto(file.mediaType)) return file;
    }
  }
  return null;
}

/**
 * A file field on the fiche (v3 médias): its files as chips — thumbnail, name — opened in one
 * click; one added by sending it from her device or by choosing one she already keeps; one taken
 * off with its cross (the file stays in her documents).
 */
export function FileField({
  entryId,
  field,
  value,
}: {
  entryId: string;
  field: EditableField;
  value: unknown;
}) {
  const change = useEntryChange(entryId);
  const { files } = useFiles();
  const input = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [sending, setSending] = useState(false);
  const ids = fileIds(value);
  const keep = (next: string[]) =>
    change.mutate({
      entries: [
        {
          id: entryId,
          data: {
            [field.path]: next.length
              ? Array.isArray(value) || next.length > 1
                ? next
                : next[0]
              : null,
          },
          origin: 'said',
        },
      ],
    });
  const add = (id: string) => {
    setChoosing(false);
    if (!ids.includes(id)) keep([...ids, id]);
  };
  const upload = async (list: File[]) => {
    if (!list.length) return;
    setSending(true);
    const added: string[] = [];
    for (const file of list) {
      try {
        added.push((await sendFile(file, { to: entryId })).entryId);
      } catch (error) {
        toast(`${file.name} : ${(error as Error).message}`, 'error');
      }
    }
    setSending(false);
    if (added.length) keep([...ids, ...added.filter((id) => !ids.includes(id))]);
  };
  return (
    <div className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-start gap-3 border-b border-rule px-4 py-2.5 last:border-0">
      <dt className="truncate pt-1 text-[13px] text-bark">{field.label}</dt>
      <dd className="grid min-w-0 gap-2">
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {ids.map((id) => {
            const file = files.find((one) => one.entryId === id);
            return (
              <span
                key={id}
                className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-[8px] border border-rule bg-paper py-1 pr-1 pl-1"
              >
                <FileThumb
                  id={id}
                  mediaType={file?.mediaType ?? ''}
                  name={file?.name ?? ''}
                  size={28}
                />
                <Link
                  to="."
                  search={peek(id)}
                  className="min-w-0 truncate text-[13px] font-semibold hover:underline"
                >
                  {file?.title || file?.name || 'Fichier'}
                </Link>
                <button
                  onClick={() => keep(ids.filter((one) => one !== id))}
                  aria-label={`Retirer ${file?.title ?? 'ce fichier'}`}
                  className="grid h-6 w-6 flex-none cursor-pointer place-items-center rounded-[6px] text-faint hover:bg-sand hover:text-ink"
                >
                  <X size={13} />
                </button>
              </span>
            );
          })}
          {!ids.length && <span className="pt-1 text-faint">—</span>}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Button size="sm" disabled={sending} onClick={() => input.current?.click()}>
            <Upload size={14} />
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
          <Button
            size="sm"
            onClick={() => setChoosing(!choosing)}
            title="Choisir parmi mes documents"
          >
            <Plus size={14} />
            Choisir
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(event) => void upload([...(event.target.files ?? [])])}
          />
        </span>
        {choosing && <EntryPicker kind="Fichier" autoFocus onPick={(one) => add(one.id)} />}
      </dd>
    </div>
  );
}

interface FileVersionView {
  n: number;
  nom: string;
  type: string;
  taille: number;
  at: string;
}

/**
 * What she can do with a file, on its fiche: a new version (the old one kept), its versions, a
 * link to share it for 24 h, sent to her Drive, erased for good after a clear yes.
 */
export function FileActions({
  id,
  title,
  data,
}: {
  id: string;
  title: string;
  data: Record<string, unknown>;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const versions = ((data.versions as FileVersionView[] | undefined) ?? []).slice().reverse();
  const drive = useQuery({
    queryKey: ['drive', 'state'],
    queryFn: () => api<{ connected: boolean }>('/drive/files'),
    staleTime: 60_000,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['entry', id] });
    void client.invalidateQueries({ queryKey: ['entries'] });
    void client.invalidateQueries({ queryKey: ['history'] });
  };
  const replace = async (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    try {
      await sendFile(file, { replace: id, onProgress: setProgress });
      toast('Nouvelle version gardée ; l’ancienne reste dans « Versions ».');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setProgress(null);
      refresh();
    }
  };
  const share = useMutation({
    mutationFn: () => api<{ url: string }>(`/files/${id}/link?seconds=86400`),
    onSuccess: async ({ url }) => {
      setShared(url);
      try {
        await navigator.clipboard.writeText(url);
        toast('Lien copié : il marche pendant 24 h.');
      } catch {
        toast('Lien prêt, valable 24 h.');
      }
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const toDrive = useMutation({
    mutationFn: () => api<{ link: string | null }>(`/drive/send/${id}`, { method: 'POST' }),
    onSuccess: () => {
      toast('Envoyé vers ton Google Drive.');
      refresh();
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  const erase = useMutation({
    mutationFn: () => api(`/files/${id}/erase`, { method: 'POST', body: { sure: true } }),
    onSuccess: () => {
      toast('Fichier supprimé définitivement.');
      refresh();
      void navigate({ to: '/documents' });
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  return (
    <Panel title="Ce fichier" icon={<Paperclip size={16} />}>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        <Button size="sm" disabled={progress !== null} onClick={() => input.current?.click()}>
          <RefreshCw size={14} />
          {progress !== null ? `Envoi… ${Math.round(progress * 100)} %` : 'Remplacer'}
        </Button>
        <Button size="sm" disabled={share.isPending} onClick={() => share.mutate()}>
          <Link2 size={14} />
          Lien de partage (24 h)
        </Button>
        {drive.data?.connected && (
          <Button size="sm" disabled={toDrive.isPending} onClick={() => toDrive.mutate()}>
            <CloudUpload size={14} />
            {data.drive_id ? 'Renvoyer vers Drive' : 'Envoyer vers Drive'}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          hidden
          onChange={(event) => void replace(event.target.files?.[0])}
        />
      </div>
      {shared && (
        <p className="border-t border-rule px-4 py-2.5 text-[12.5px] break-all text-bark">
          <a
            href={shared}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            {shared}
          </a>
        </p>
      )}
      {versions.length > 0 && (
        <div className="border-t border-rule">
          <p className="flex items-center gap-2 px-4 pt-2.5 text-[13px] font-semibold">
            <History size={14} className="text-bark" />
            Versions précédentes
          </p>
          {versions.map((one) => (
            <a
              key={one.n}
              href={fileHref(id, {}, `/versions/${one.n}`)}
              target="_blank"
              rel="noreferrer"
              className={rowClass}
            >
              <span className="font-mono text-[11.5px] text-faint">v{one.n}</span>
              <span className="min-w-0 flex-1 truncate">{one.nom}</span>
              <span className="flex-none text-[12px] text-bark">
                {size(one.taille)} · {ago(one.at)}
              </span>
            </a>
          ))}
        </div>
      )}
      <div className="border-t border-rule px-4 py-3">
        <button
          onClick={() =>
            confirm.ask({
              title: 'Supprimer définitivement ?',
              lead: (
                <>
                  « {title} » et toutes ses versions seront effacés de ton stockage. Ce n’est pas
                  réversible : on ne pourra pas le récupérer. Les entrées liées restent, sans ce
                  fichier.
                </>
              ),
              yes: 'Supprimer définitivement',
              danger: true,
              then: () => erase.mutate(),
            })
          }
          disabled={erase.isPending}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-error hover:underline"
        >
          <Trash2 size={14} />
          Supprimer définitivement
        </button>
      </div>
      {confirm.node}
    </Panel>
  );
}

interface DriveFile {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  modified: string;
  link: string | null;
}

/**
 * Her Google Drive in Documents (v3 médias): the files Jarvis may see there (those it put there or
 * she opened with it), each brought in with « Importer ». Not connected: where to connect it.
 */
export function DrivePanel() {
  const client = useQueryClient();
  const drive = useQuery({
    queryKey: ['drive', 'files'],
    queryFn: () => api<{ connected: boolean; error?: string; files: DriveFile[] }>('/drive/files'),
  });
  const bring = useMutation({
    mutationFn: (fileId: string) =>
      api<{ entryId: string }>(`/drive/files/${fileId}/import`, { method: 'POST' }),
    onSuccess: () => {
      toast('Importé : Jarvis le lit, ce qu’il en tire t’attendra dans « À valider ».');
      void client.invalidateQueries({ queryKey: ['entries'] });
    },
    onError: (error) => toast((error as Error).message, 'error'),
  });
  if (drive.isLoading) return null;
  if (!drive.data?.connected)
    return (
      <p className="rounded-[10px] border border-rule bg-paper px-4 py-3 text-[13px] text-bark">
        Tes fichiers Google Drive peuvent venir ici : branche Google Drive dans{' '}
        <Link to="/reglages" className="font-semibold text-primary hover:underline">
          Réglages › Connexions
        </Link>
        .
      </p>
    );
  const files = drive.data.files;
  return (
    <Panel title="Google Drive" icon={<CloudDownload size={16} />}>
      {drive.data.error ? (
        <p className="px-4 py-3 text-[13px] text-error">{drive.data.error}</p>
      ) : files.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-bark">
          Jarvis ne voit que les fichiers qu’il a mis dans ton Drive ou que tu as ouverts avec lui.
          Rien pour l’instant.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {files.map((one) => (
            <div
              key={one.id}
              className="flex items-center gap-2.5 border-b border-rule px-4 py-2 last:border-0"
            >
              <FileIcon mediaType={one.mediaType} name={one.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{one.name}</span>
                <span className="block text-[12px] text-bark">
                  {one.size ? `${size(one.size)} · ` : ''}
                  {one.modified ? ago(one.modified) : ''}
                </span>
              </span>
              <Button
                size="sm"
                disabled={bring.isPending && bring.variables === one.id}
                onClick={() => bring.mutate(one.id)}
              >
                Importer
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
