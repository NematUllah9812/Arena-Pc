import Image from 'next/image';

export function ProductImage({
  src,
  alt,
  sizes = '(max-width: 768px) 50vw, 25vw',
  priority = false,
  className = '',
  fit = 'contain'
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fit?: 'contain' | 'cover';
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.endsWith('.svg') || src.startsWith('/api/') || src.startsWith('data:') || src.startsWith('blob:')}
      className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  );
}
