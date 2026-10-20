import { getRepo } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** Memory-mode proof storage (Supabase mode serves proofs straight from the Storage bucket). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w.-]{6,120}$/.test(id)) return new Response('Not found', { status: 404 });
  const proof = await getRepo().readProof?.(id);
  if (!proof) return new Response('Not found', { status: 404 });
  return new Response(new Blob([proof.bytes as BlobPart], { type: proof.contentType }), {
    headers: { 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }
  });
}
