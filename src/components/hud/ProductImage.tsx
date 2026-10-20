import Image from 'next/image';

export function ProductImage({ src, alt, sizes = '(max-width: 768px) 100vw, 25vw', priority = false, className = '' }: { src: string; alt: string; sizes?: string; priority?: boolean; className?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.endsWith('.svg')}
      className={`object-cover ${className}`}
    />
  );
}
