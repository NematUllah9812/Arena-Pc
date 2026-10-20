/// <reference lib="webworker" />
/**
 * Off-main-thread prefix trie for instant catalog search (Spec §3 "Local Search Trie").
 * Tokens: name words, brand, SKU fragments, category and key spec values.
 */
export interface IndexEntry {
  id: string;
  n: string;
  b: string;
  s: string;
  c: string;
  slug: string;
  p: number;
  img: string;
  k: string;
}

interface Node {
  c: Map<string, Node>;
  ids: Set<number>;
}

const root: Node = { c: new Map(), ids: new Set() };
let entries: IndexEntry[] = [];

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 0);

function insert(token: string, idx: number) {
  let node = root;
  for (const ch of token.slice(0, 24)) {
    let next = node.c.get(ch);
    if (!next) {
      next = { c: new Map(), ids: new Set() };
      node.c.set(ch, next);
    }
    next.ids.add(idx);
    node = next;
  }
}

function intersect(a: Set<number> | null, b: Set<number>): Set<number> {
  if (!a) return new Set(b);
  const out = new Set<number>();
  a.forEach((x) => {
    if (b.has(x)) out.add(x);
  });
  return out;
}

function lookup(prefix: string): Set<number> {
  let node: Node | undefined = root;
  for (const ch of prefix.slice(0, 24)) {
    node = node.c.get(ch);
    if (!node) return new Set();
  }
  return node.ids;
}

self.onmessage = (e: MessageEvent<{ type: 'index'; entries: IndexEntry[] } | { type: 'query'; q: string; seq: number }>) => {
  const msg = e.data;
  if (msg.type === 'index') {
    entries = msg.entries;
    entries.forEach((en, i) => {
      for (const t of new Set([...tokenize(en.n), ...tokenize(en.b), ...tokenize(en.c), ...tokenize(en.k), en.s.toLowerCase(), ...en.s.toLowerCase().split('-')])) insert(t, i);
    });
    (self as unknown as Worker).postMessage({ type: 'ready', size: entries.length });
    return;
  }
  const terms = tokenize(msg.q);
  if (!terms.length) {
    (self as unknown as Worker).postMessage({ type: 'results', seq: msg.seq, results: [] });
    return;
  }
  let acc: Set<number> | null = null;
  for (const t of terms) {
    const hits = lookup(t);
    acc = intersect(acc as Set<number> | null, hits);
    if (!acc.size) break;
  }
  const scored = [...(acc ?? [])].map((i) => {
    const en = entries[i];
    const name = en.n.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (name.startsWith(t)) score += 5;
      else if (name.includes(` ${t}`)) score += 3;
      else if (en.s.toLowerCase().includes(t)) score += 2;
      else score += 1;
    }
    return { en, score };
  });
  scored.sort((a, b) => b.score - a.score || a.en.n.localeCompare(b.en.n));
  (self as unknown as Worker).postMessage({ type: 'results', seq: msg.seq, results: scored.slice(0, 12).map((x) => x.en) });
};
