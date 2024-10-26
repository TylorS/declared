import type { Pipeable } from "@declared/pipeable";
import type { Effect } from "../effect/effect.ts";
import { ThisIterable } from "../internal/generators.ts";

const globalTagMapSymbol = Symbol.for("@declared/TagMap");
const globalTagMap = Reflect.get(globalThis, globalTagMapSymbol) ??
  Reflect.set(globalThis, globalTagMapSymbol, new Map());

export const TypeId = Symbol.for("@declared/Tag");
export type TypeId = typeof TypeId;

export interface Tag<out Id, out Value> extends Pipeable {
  readonly _id: "Tag";
  readonly identifier: string;
  readonly [TypeId]: Tag.Variance<Id, Value>;
  readonly [Symbol.iterator]: () => Effect.Iterator<Tag<Id, Value>, Value>;
}

const variance: Tag.Variance<any, any> = {
  _Id: (_) => _,
  _Value: (_) => _,
};

export function Tag<Id, Value = Id>(identifer: string): Tag<Id, Value> {
  const existing = globalTagMap.get(identifer);
  if (existing) {
    return existing;
  }

  const tag = Object.create(ThisIterable);
  tag._effect = "Sync";
  tag.tag = "Tag";
  tag.identifier = identifer;
  tag[TypeId] = variance;

  globalTagMap.set(identifer, tag);

  return tag;
}

export declare namespace Tag {
  export interface Variance<out Id, out Value> {
    readonly _Id: (_: never) => Id;
    readonly _Value: (_: never) => Value;
  }
}
