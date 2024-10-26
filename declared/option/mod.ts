import type { Effect } from "../effect/effect.ts";
import { ErrorIterable, ThisIterable } from "../internal/generators.ts";

export type Option<Value> = Some<Value> | None;

export interface Some<Value> extends Effect<never, never, Value> {
  readonly _id: "Some";
  readonly value: Value;
}

export interface None extends Effect<never, never, never> {
  readonly _id: "None";
}

export const some = <Value>(value: Value): Some<Value> => {
  const proto = Object.create(ThisIterable);
  proto._id = "Some";
  proto.value = value;
  return proto;
};

const NONE_ID = "None";

class NoneImpl extends ErrorIterable implements None {
  readonly _id = NONE_ID;
}

export const none = (): None => new NoneImpl();

const SOME_ID = "Some";

export const isSome = <Value>(option: Option<Value>): option is Some<Value> =>
  option._id === SOME_ID;

export const isNone = <Value>(option: Option<Value>): option is None =>
  option._id === NONE_ID;
