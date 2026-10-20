/**
 * Deterministic RFC-4122-shaped UUID derived from a seed string.
 * Lets the in-memory store, the SQL seed and the tests agree on IDs
 * without a database round-trip.
 */
export function stableUuid(seed: string): string {
  const hex = (h: number) => (h >>> 0).toString(16).padStart(8, '0');
  const hashes: number[] = [];
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5 ^ (round * 0x9e3779b9);
    const s = `${round}:${seed}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // final avalanche
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    hashes.push(h);
  }
  const raw = hashes.map(hex).join('');
  const variant = ((parseInt(raw[16], 16) & 0x3) | 0x8).toString(16);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-5${raw.slice(13, 16)}-${variant}${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
