import { Pipeable, pipeArguments } from "@declared/pipeable";

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

export function map<V, K, const W>(
  f: (v: V, key: K) => W,
): (map: Map<K, V>) => Map<K, W> {
  return (map) => make(entries(map).map(([k, v]) => [k, f(v, k)]));
}

declare global {
  interface ReadonlyMap<K, V> extends Pipeable {}
  interface Map<K, V> extends Pipeable {}
}

Map.prototype.pipe = function pipe(this: Map<unknown, unknown>) {
  return pipeArguments(this, arguments);
};
