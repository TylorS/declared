export interface Map<K, V> extends globalThis.Map<K, V> {}

export function empty<K, V>(): Map<K, V> {
  return new Map();
}

export function make<K, V>(entries: Iterable<[K, V]>): Map<K, V> {
  return new Map(entries);
}

export function entries<K, V>(map: Map<K, V>): MapIterator<[K, V]> {
  return map.entries();
}

export function map<K, V, W>(
  map: Map<K, V>,
  f: (v: V, key: K) => W,
): Map<K, W> {
  return make(entries(map).map(([k, v]) => [k, f(v, k)]));
}
