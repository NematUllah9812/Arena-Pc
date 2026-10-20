'use client';
import Image from 'next/image';
import { useState } from 'react';

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const current = list[Math.min(active, list.length - 1)] ?? '/media/cat-case.webp';
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-hairline bg-white">
        <Image src={current} alt={alt} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-8" unoptimized={current.endsWith('.svg')} />
      </div>
      {list.length > 1 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Product photos">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Photo ${i + 1}`}
              onClick={() => setActive(i)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-white ${i === active ? 'border-volt ring-2 ring-volt/20' : 'border-hairline hover:border-[#d1d5db]'}`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-contain p-1.5" unoptimized={src.endsWith('.svg')} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
