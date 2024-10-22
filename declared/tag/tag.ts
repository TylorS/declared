import type { Effect } from "@declared/effect";
import { ThisIterable } from "../internal/generators.ts";

const globalTagMapSymbol = Symbol.for("@declared/Tag/Map");
const globalTagMap = Reflect.get(globalThis, globalTagMapSymbol) ??
  Reflect.set(globalThis, globalTagMapSymbol, new Map());

export const TypeId = Symbol.for("@declared/Tag");
export type TypeId = typeof TypeId;

export interface Tag<in out Id, out Value> extends Effect<Id, never, Value> {
  readonly [TypeId]: Tag.Variance<Id, Value>;
}

const variance: Tag.Variance<any, any> = {
  _Id: (_) => _,
  _Value: (_) => _,
};

export function Tag<Id, Value = Id>(identifer: string): Tag<Id, Value> {
  if (globalTagMap.has(identifer)) {
    return globalTagMap.get(identifer) as Tag<Id, Value>;
  }

  const tag = Object.create(ThisIterable);
  tag[TypeId] = variance;

  globalTagMap.set(identifer, tag);

  return tag;
}

export declare namespace Tag {
  export interface Variance<Id, Value> {
    readonly _Id: (_: Id) => Id;
    readonly _Value: (_: never) => Value;
  }
}
