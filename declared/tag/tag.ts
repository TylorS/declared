import { ThisIterable } from "../internal/generators.ts";
import type { Effect } from "../mod.ts";

const globalTagMapSymbol = Symbol.for("@declared/TagMap");

let globalTagMap: Map<string, Tag<any, any>> = Reflect.get(
  globalThis,
  globalTagMapSymbol,
);
if (!globalTagMap) {
  globalTagMap = new Map();
  Reflect.set(globalThis, globalTagMapSymbol, globalTagMap);
}

export const TypeId = Symbol.for("@declared/Tag");
export type TypeId = typeof TypeId;

export interface Tag<out Id, out Value>
  extends Effect.Effect<Id, never, Value> {
  readonly _id: "Tag";
  readonly identifier: string;
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

  const tag = Object.create(ThisIterable.prototype);
  tag._id = "Tag";
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
