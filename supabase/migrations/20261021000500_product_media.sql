-- Product photo storage for the admin photo manager.
-- Uploads are re-encoded to WebP server-side and written with the service role;
-- the bucket is public-read so storefront <img> tags can load them directly.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-media', 'product-media', TRUE, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Category stock photos moved from SVG to WebP.
UPDATE public.products
SET primary_image_url = replace(primary_image_url, '.svg', '.webp')
WHERE primary_image_url LIKE '/media/cat-%.svg';
