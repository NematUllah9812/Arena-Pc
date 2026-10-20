import sharp from 'sharp';
import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, readJson } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';
import { productPhotos } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PHOTOS = 8;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']);
const uuid = z.string().uuid();

async function load(id: string) {
  if (!uuid.safeParse(id).success) return null;
  return getRepo().getProductInternal(id);
}

const photosResponse = (p: { primary_image_url: string; gallery_urls: string[] }) => ({ ok: true, photos: productPhotos(p), primary: p.primary_image_url });

/** List the admin-managed photos for a product. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi('inventory');
  if ('error' in auth) return auth.error;
  const product = await load((await params).id);
  if (!product) return json({ ok: false, error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  return json(photosResponse(product));
}

/** Upload one or more photos (multipart field "files"). Each is re-encoded to WebP, max 1600px, EXIF stripped. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi('inventory');
  if ('error' in auth) return auth.error;
  const product = await load((await params).id);
  if (!product) return json({ ok: false, error: 'PRODUCT_NOT_FOUND' }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: 'INVALID_UPLOAD', detail: 'Expected multipart form data.' }, { status: 400 });
  }
  const files = form.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f);
  if (!files.length) return json({ ok: false, error: 'INVALID_UPLOAD', detail: 'No files received.' }, { status: 400 });

  const current = productPhotos(product);
  if (current.length + files.length > MAX_PHOTOS) return json({ ok: false, error: 'TOO_MANY_PHOTOS', detail: `A product can have up to ${MAX_PHOTOS} photos.` }, { status: 422 });

  const repo = getRepo();
  const uploaded: string[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, error: 'FILE_TOO_LARGE', detail: `${file.name} is larger than 10 MB.` }, { status: 413 });
    if (file.type && !ACCEPTED.has(file.type)) return json({ ok: false, error: 'UNSUPPORTED_TYPE', detail: `${file.name} is not a supported image type.` }, { status: 415 });
    let webp: Buffer;
    try {
      webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      return json({ ok: false, error: 'UNREADABLE_IMAGE', detail: `${file.name} could not be read as an image.` }, { status: 422 });
    }
    uploaded.push(await repo.storeProductImage(product.id, new Uint8Array(webp)));
  }

  const res = await repo.updateProductImages({ adminId: auth.admin.id, productId: product.id, photos: [...current, ...uploaded], ip: auth.ip });
  if (!res.ok) return json(res, { status: 422 });
  return json(photosResponse(res.value));
}

const reorder = z.object({ photos: z.array(z.string().max(600)).max(MAX_PHOTOS) });

/** Reorder / choose main photo / remove from list. Only URLs already on the product are accepted. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi('inventory');
  if ('error' in auth) return auth.error;
  const product = await load((await params).id);
  if (!product) return json({ ok: false, error: 'PRODUCT_NOT_FOUND' }, { status: 404 });
  const parsed = reorder.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });

  const current = productPhotos(product);
  const next = [...new Set(parsed.data.photos)];
  if (next.some((u) => !current.includes(u))) return json({ ok: false, error: 'UNKNOWN_PHOTO' }, { status: 422 });

  const repo = getRepo();
  const res = await repo.updateProductImages({ adminId: auth.admin.id, productId: product.id, photos: next, ip: auth.ip });
  if (!res.ok) return json(res, { status: 422 });
  // Removed photos: delete the stored objects (best effort).
  await Promise.all(current.filter((u) => !next.includes(u)).map((u) => repo.deleteProductImage(u).catch(() => undefined)));
  return json(photosResponse(res.value));
}
