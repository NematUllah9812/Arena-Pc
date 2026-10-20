import type { CSSProperties, ReactNode } from 'react';

type Tone = 'default' | 'tungsten' | 'cryo' | 'selected';

export function HudCard({
  children,
  className = '',
  innerClassName = '',
  tone = 'default',
  interactive = false,
  as: Tag = 'div',
  style
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  tone?: Tone;
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
  style?: CSSProperties;
}) {
  const toneClass = tone === 'selected' ? 'is-selected' : tone !== 'default' ? `tone-${tone}` : '';
  return (
    <Tag className={`hud-card ${interactive ? 'is-interactive' : ''} ${toneClass} ${className}`} style={style}>
      <div className={`hud-card-inner ${innerClassName}`}>{children}</div>
    </Tag>
  );
}

export function SectionHeader({ eyebrow, title, children, align = 'left' }: { eyebrow: string; title: ReactNode; children?: ReactNode; align?: 'left' | 'center' }) {
  return (
    <header className={`mb-8 flex flex-col gap-3 ${align === 'center' ? 'items-center text-center' : ''}`}>
      <span className="hud-eyebrow">{eyebrow}</span>
      <h2 className="hud-title glitch text-3xl md:text-5xl">{title}</h2>
      {children ? <div className="max-w-2xl text-sm leading-relaxed text-secondary">{children}</div> : null}
    </header>
  );
}

export function Meter({ value, max = 10, tone }: { value: number; max?: number; tone?: 'tungsten' | 'cryo' }) {
  const on = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <div className={`meter ${tone ? `tone-${tone}` : ''}`} style={{ gridTemplateColumns: `repeat(${max}, 1fr)` }} aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < on ? 'on' : ''} />
      ))}
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: 'volt' | 'tungsten' | 'cryo' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <span className={`tabular text-lg ${accent ? `text-${accent}` : 'text-primary'}`}>{value}</span>
    </div>
  );
}
