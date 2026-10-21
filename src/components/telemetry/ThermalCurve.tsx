/** Server-renderable SVG thermal curve (CPU tungsten / GPU cryo) from OCCT burn-in samples. */
export function ThermalCurve({ points, height = 220 }: { points: { t: number; cpu: number; gpu: number }[]; height?: number }) {
  if (points.length < 2) return null;
  const W = 640;
  const H = height;
  const pad = { l: 40, r: 72, t: 14, b: 26 };
  const tMax = Math.max(...points.map((p) => p.t));
  const yMin = 20;
  const yMax = Math.max(95, Math.ceil(Math.max(...points.flatMap((p) => [p.cpu, p.gpu])) / 5) * 5);
  const x = (t: number) => pad.l + (t / tMax) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = (k: 'cpu' | 'gpu') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const peak = (k: 'cpu' | 'gpu') => points.reduce((a, b) => (b[k] > a[k] ? b : a));
  const grid = [];
  for (let v = yMin; v <= yMax; v += 10) grid.push(v);
  const hours = Math.ceil(tMax / 60);

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Temperature during stress test">
        {grid.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
              {v}°
            </text>
          </g>
        ))}
        {Array.from({ length: hours + 1 }, (_, h) => (
          <text key={h} x={x(Math.min(h * 60, tMax))} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
            {h}h
          </text>
        ))}
        <path d={path('gpu')} fill="none" stroke="var(--accent-cryo)" strokeWidth="1.75" />
        <path d={path('cpu')} fill="none" stroke="var(--accent-tungsten)" strokeWidth="1.75" />
        {(['cpu', 'gpu'] as const).map((k) => {
          const p = peak(k);
          return (
            <g key={k}>
              <circle cx={x(p.t)} cy={y(p[k])} r="3.5" fill={k === 'cpu' ? 'var(--accent-tungsten)' : 'var(--accent-cryo)'} />
              <text x={x(p.t) + 6} y={y(p[k]) - 6} fontSize="10" fill={k === 'cpu' ? 'var(--accent-tungsten)' : 'var(--accent-cryo)'} fontFamily="var(--font-mono)">
                {k.toUpperCase()} {p[k]}°C
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-tungsten" /> CPU
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-cryo" /> GPU
        </span>
        <span>{points.length} readings over the test</span>
      </figcaption>
    </figure>
  );
}
