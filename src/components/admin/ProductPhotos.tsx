'use client';
import { useRef, useState, type DragEvent } from 'react';
import { ProductImage } from '@/components/hud/ProductImage';
import { useToast } from '@/components/layout/Toasts';
import { ImageIcon, StarIcon, TrashIcon, UploadIcon } from '@/components/ui/Icons';
import { adminFetch } from './adminFetch';

const MAX_PHOTOS = 8;
/** Keep each request well under the 4.5 MB serverless body limit. */
const MAX_EDGE = 2000;
const SEND_LIMIT = 4 * 1024 * 1024;

type PhotosResponse = { photos: string[]; primary: string };

/** Downscale large photos in the browser before upload (server re-encodes to WebP anyway). */
async function prepare(file: File): Promise<Blob> {
  if (file.size <= 1.5 * 1024 * 1024 && /image\/(jpeg|webp|png)/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    return blob ?? file;
  } catch {
    return file; // e.g. HEIC on browsers that can't decode it — let the server try.
  }
}

export function ProductPhotos({ productId, productName, initial, onChange }: { productId: string; productName: string; initial: string[]; onChange: (photos: string[], primary: string) => void }) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  const apply = (res: PhotosResponse) => {
    setPhotos(res.photos);
    onChange(res.photos, res.primary);
  };

  const upload = async (list: FileList | File[]) => {
    const files = [...list].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return push({ title: 'Please choose image files', tone: 'warn' });
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return push({ title: `Up to ${MAX_PHOTOS} photos per product`, body: 'Remove one to add another.', tone: 'warn' });
    const batch = files.slice(0, room);
    if (files.length > room) push({ title: `Only ${room} more photo${room === 1 ? '' : 's'} allowed`, body: `Uploading the first ${room}.`, tone: 'warn' });

    for (let i = 0; i < batch.length; i++) {
      setBusy(batch.length > 1 ? `Uploading ${i + 1} of ${batch.length}…` : 'Uploading…');
      const blob = await prepare(batch[i]);
      if (blob.size > SEND_LIMIT) {
        push({ title: `${batch[i].name} is too large`, body: 'Try a smaller photo (under 4 MB).', tone: 'error' });
        continue;
      }
      const fd = new FormData();
      fd.append('files', blob, batch[i].name.replace(/\.\w+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : ''));
      const res = await adminFetch<PhotosResponse>(`/admin/api/products/${productId}/images`, { method: 'POST', body: fd });
      if (!res.ok) {
        push({ title: 'Upload failed', body: res.detail ?? res.error, tone: 'error' });
        break;
      }
      apply(res);
    }
    setBusy(null);
    if (input.current) input.current.value = '';
  };

  const save = async (next: string[], label: string) => {
    setBusy(label);
    const res = await adminFetch<PhotosResponse>(`/admin/api/products/${productId}/images`, { method: 'PUT', json: { photos: next } });
    setBusy(null);
    if (!res.ok) return push({ title: 'Couldn’t update photos', body: res.detail ?? res.error, tone: 'error' });
    apply(res);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    void save(next, 'Saving order…');
  };

  const makeMain = (i: number) => void save([photos[i], ...photos.filter((_, k) => k !== i)], 'Saving…');
  const remove = (i: number) => {
    if (!confirm('Delete this photo? This can’t be undone.')) return;
    void save(
      photos.filter((_, k) => k !== i),
      'Deleting…'
    );
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDrag(false);
    if (busy) return;
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((src, i) => (
            <li key={src} className={`group relative overflow-hidden rounded-lg border bg-white ${i === 0 ? 'border-volt ring-1 ring-volt' : 'border-hairline'}`}>
              <div className="relative aspect-square">
                <ProductImage src={src} alt={`${productName} photo ${i + 1}`} sizes="140px" />
              </div>
              {i === 0 ? <span className="absolute top-1.5 left-1.5 rounded-full bg-volt px-2 py-0.5 text-[0.65rem] font-semibold text-white">Main</span> : null}
              <div className="flex items-center justify-between border-t border-hairline bg-white px-1 py-1">
                <span className="flex">
                  <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-chassis hover:text-primary disabled:opacity-30" onClick={() => move(i, -1)} disabled={!!busy || i === 0} aria-label="Move left" title="Move left">
                    ‹
                  </button>
                  <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-chassis hover:text-primary disabled:opacity-30" onClick={() => move(i, 1)} disabled={!!busy || i === photos.length - 1} aria-label="Move right" title="Move right">
                    ›
                  </button>
                </span>
                <span className="flex">
                  {i !== 0 ? (
                    <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-chassis hover:text-volt disabled:opacity-30" onClick={() => makeMain(i)} disabled={!!busy} aria-label="Make main photo" title="Make main photo">
                      <StarIcon size={15} />
                    </button>
                  ) : null}
                  <button type="button" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-[#fef2f2] hover:text-conflict disabled:opacity-30" onClick={() => remove(i)} disabled={!!busy} aria-label="Delete photo" title="Delete photo">
                    <TrashIcon size={15} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-chassis px-3 py-2.5 text-sm text-secondary">
          <ImageIcon size={18} className="text-muted" /> No photos yet — the store shows a generic category photo.
        </p>
      )}

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        disabled={!!busy || photos.length >= MAX_PHOTOS}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${drag ? 'border-volt bg-[#eff6ff]' : 'border-hairline hover:border-volt hover:bg-[#f8fafc]'}`}
      >
        <UploadIcon size={22} className="text-volt" />
        <span className="text-sm font-medium text-primary">{busy ?? (photos.length >= MAX_PHOTOS ? `Maximum of ${MAX_PHOTOS} photos reached` : 'Click to upload or drag photos here')}</span>
        <span className="text-xs text-muted">JPG, PNG, WebP or HEIC · converted to WebP automatically · up to {MAX_PHOTOS} photos</span>
      </button>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      <p className="text-xs text-muted">Tip: the first photo is the main one shown in listings. Square photos on a plain white background look best.</p>
    </div>
  );
}
