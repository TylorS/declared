import * as AsyncIterable from "@declared/async_iterable";

export type Option<Value> = Some<Value> | None;

export class Some<Value> extends AsyncIterable.Yieldable("Some")<Value> {
  constructor(readonly value: Value) {
    super();
  }
}

export class None extends AsyncIterable.Failure("None") {}

export const some = <Value>(value: Value): Some<Value> => new Some(value);

export const none = (): None => new None();

export const isSome = <Value>(option: Option<Value>): option is Some<Value> =>
  option._id === Some._id;

export const isNone = <Value>(option: Option<Value>): option is None =>
  option._id === None._id;
